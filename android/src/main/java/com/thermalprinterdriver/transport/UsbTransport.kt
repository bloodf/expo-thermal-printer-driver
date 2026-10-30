package com.thermalprinterdriver.transport

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import android.util.Log
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.io.IOException

/**
 * USB transport for printers attached in USB host mode (OTG).
 *
 * Address format: `usb:<vendorId>:<productId>` in hex (e.g. `usb:04b8:0202`). The first
 * attached device matching both IDs is used. Works with USB printer-class interfaces
 * (class 7) and vendor-specific interfaces (e.g. Epson TM printers in vendor mode), as
 * long as they expose a bulk OUT endpoint.
 *
 * If the app has no permission for the device yet, [connect] shows Android's
 * "Allow access to USB device" dialog and waits for the user's answer.
 */
class UsbTransport(
    private val context: Context,
    private val vendorId: Int,
    private val productId: Int,
) : Transport {

    companion object {
        private const val TAG = "UsbTransport"
        private const val ACTION_USB_PERMISSION = "com.thermalprinterdriver.USB_PERMISSION"
        private const val PERMISSION_TIMEOUT_MS = 60_000L
        private const val WRITE_TIMEOUT_MS = 5_000
        // bulkTransfer accepted at most 16 KB per call before API 28
        private const val MAX_CHUNK_BYTES = 16 * 1024

        /** Parse `<vid>:<pid>` (hex) from a `usb:` address target. */
        fun parseTarget(target: String): Pair<Int, Int> {
            val parts = target.split(":")
            if (parts.size < 2) throw IOException("Invalid USB address 'usb:$target', expected usb:<vid>:<pid>")
            val vid = parts[0].toIntOrNull(16)
            val pid = parts[1].toIntOrNull(16)
            if (vid == null || pid == null) {
                throw IOException("Invalid USB address 'usb:$target', IDs must be hex")
            }
            return vid to pid
        }

        /** Canonical driver address for a USB device. */
        fun addressOf(device: UsbDevice): String =
            "usb:%04x:%04x".format(device.vendorId, device.productId)

        /**
         * The interface + bulk OUT endpoint to print through, preferring the USB printer
         * class over vendor-specific interfaces. Null when the device can't take print data.
         */
        fun findPrintEndpoint(device: UsbDevice): Pair<UsbInterface, UsbEndpoint>? {
            val candidates = (0 until device.interfaceCount).map { device.getInterface(it) }
                .sortedBy { if (it.interfaceClass == UsbConstants.USB_CLASS_PRINTER) 0 else 1 }
            for (intf in candidates) {
                if (intf.interfaceClass != UsbConstants.USB_CLASS_PRINTER &&
                    intf.interfaceClass != UsbConstants.USB_CLASS_VENDOR_SPEC
                ) continue
                for (e in 0 until intf.endpointCount) {
                    val endpoint = intf.getEndpoint(e)
                    if (endpoint.type == UsbConstants.USB_ENDPOINT_XFER_BULK &&
                        endpoint.direction == UsbConstants.USB_DIR_OUT
                    ) {
                        return intf to endpoint
                    }
                }
            }
            return null
        }
    }

    private val usbManager = context.getSystemService(Context.USB_SERVICE) as UsbManager

    private var device: UsbDevice? = null
    private var connection: UsbDeviceConnection? = null
    private var printInterface: UsbInterface? = null
    private var outEndpoint: UsbEndpoint? = null

    private val label get() = "usb:%04x:%04x".format(vendorId, productId)

    override suspend fun connect(): Unit = withContext(Dispatchers.IO) {
        Log.d(TAG, "[Native:Android] UsbTransport.connect START: $label")
        close()

        val target = usbManager.deviceList.values.firstOrNull {
            it.vendorId == vendorId && it.productId == productId
        } ?: throw IOException("USB printer $label is not attached")

        val (intf, endpoint) = findPrintEndpoint(target)
            ?: throw IOException("USB device $label has no printer interface with a bulk OUT endpoint")

        if (!usbManager.hasPermission(target) && !requestPermission(target)) {
            throw IOException("USB permission denied for $label")
        }

        val conn = usbManager.openDevice(target)
            ?: throw IOException("Could not open USB device $label")
        if (!conn.claimInterface(intf, true)) {
            conn.close()
            throw IOException("Could not claim the printer interface on $label")
        }

        device = target
        connection = conn
        printInterface = intf
        outEndpoint = endpoint
        Log.d(TAG, "[Native:Android] UsbTransport.connect SUCCESS: $label (interface class ${intf.interfaceClass})")
    }

    override suspend fun write(data: ByteArray): Unit = withContext(Dispatchers.IO) {
        val conn = connection ?: throw IOException("Not connected to $label")
        val endpoint = outEndpoint ?: throw IOException("Not connected to $label")

        var offset = 0
        while (offset < data.size) {
            val length = minOf(MAX_CHUNK_BYTES, data.size - offset)
            val written = conn.bulkTransfer(endpoint, data, offset, length, WRITE_TIMEOUT_MS)
            if (written <= 0) {
                throw IOException("USB write failed on $label after $offset of ${data.size} bytes")
            }
            offset += written
        }
        Log.d(TAG, "[Native:Android] UsbTransport.write SUCCESS: ${data.size} bytes to $label")
    }

    override fun close() {
        val conn = connection
        try {
            printInterface?.let { conn?.releaseInterface(it) }
            conn?.close()
        } catch (e: Exception) {
            Log.w(TAG, "[Native:Android] UsbTransport.close WARN: ${e.message}")
        } finally {
            connection = null
            printInterface = null
            outEndpoint = null
            device = null
        }
    }

    override fun isConnected(): Boolean {
        val current = device ?: return false
        // Unplugging doesn't close the connection, so check the device is still attached
        return connection != null && usbManager.deviceList.containsKey(current.deviceName)
    }

    /** Show the system permission dialog and wait for the user's answer. */
    private suspend fun requestPermission(target: UsbDevice): Boolean {
        val result = CompletableDeferred<Boolean>()
        val receiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                if (intent.action == ACTION_USB_PERMISSION) {
                    result.complete(intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false))
                }
            }
        }
        val filter = IntentFilter(ACTION_USB_PERMISSION)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            context.registerReceiver(receiver, filter)
        }

        return try {
            // The system fills in extras, so the PendingIntent must be mutable (API 31+);
            // setPackage keeps the mutable intent explicit, as API 34 requires.
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
            val intent = Intent(ACTION_USB_PERMISSION).setPackage(context.packageName)
            val pending = PendingIntent.getBroadcast(context, 0, intent, flags)
            withContext(Dispatchers.Main) { usbManager.requestPermission(target, pending) }
            withTimeoutOrNull(PERMISSION_TIMEOUT_MS) { result.await() } ?: false
        } finally {
            try { context.unregisterReceiver(receiver) } catch (e: Exception) { /* already unregistered */ }
        }
    }
}
