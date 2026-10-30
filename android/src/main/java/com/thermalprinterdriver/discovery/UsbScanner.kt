package com.thermalprinterdriver.discovery

import android.content.Context
import android.hardware.usb.UsbManager
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.thermalprinterdriver.transport.UsbTransport

/**
 * Lists attached USB devices that can take print data: a printer-class or
 * vendor-specific interface with a bulk OUT endpoint. Needs no permission;
 * access is requested when connecting.
 */
class UsbScanner(private val context: Context) {

    companion object {
        private const val TAG = "UsbScanner"
    }

    fun scan(): WritableArray {
        val usbManager = context.getSystemService(Context.USB_SERVICE) as? UsbManager
        val result = Arguments.createArray()
        if (usbManager == null) {
            Log.d(TAG, "[Native:Android] UsbScanner: USB host not supported")
            return result
        }

        for (device in usbManager.deviceList.values) {
            if (UsbTransport.findPrintEndpoint(device) == null) continue
            // Descriptor strings can throw SecurityException on some devices before access is granted
            val name = listOfNotNull(
                runCatching { device.manufacturerName }.getOrNull(),
                runCatching { device.productName }.getOrNull(),
            ).joinToString(" ")
                .ifBlank { "USB Printer %04x:%04x".format(device.vendorId, device.productId) }
            val map = Arguments.createMap()
            map.putString("name", name)
            map.putString("address", UsbTransport.addressOf(device))
            map.putString("deviceType", "usb")
            map.putInt("rssi", 0)
            result.pushMap(map)
            Log.d(TAG, "[Native:Android] UsbScanner found: $name (${UsbTransport.addressOf(device)})")
        }
        return result
    }
}
