package com.thermalprinterdriver.discovery

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

/**
 * Promise-based Bluetooth device scanner.
 *
 * Uses BluetoothAdapter.startDiscovery() + BroadcastReceiver for ACTION_FOUND /
 * ACTION_DISCOVERY_FINISHED. The promise is resolved only after discovery finishes
 * (or the 15-second timeout fires). Returns a WritableMap with "paired" and "found" arrays.
 *
 * Requires BLUETOOTH_SCAN and BLUETOOTH_CONNECT permissions on Android 12+.
 */
class DeviceScanner(private val reactContext: ReactApplicationContext) {

    companion object {
        private const val TAG = "DeviceScanner"
        private const val SCAN_TIMEOUT_MS = 15_000L
    }

    private val bluetoothAdapter: BluetoothAdapter? by lazy {
        val manager = reactContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
        manager?.adapter
    }

    @Volatile private var isScanning = false
    private var receiver: BroadcastReceiver? = null
    private val pairedDevices = mutableListOf<DeviceInfo>()
    private val foundDevices = mutableListOf<DeviceInfo>()

    /** Start scan and resolve promise when discovery finishes or times out. */
    suspend fun scanDevices(promise: Promise) {
        withContext(Dispatchers.IO) {
            try {
                val adapter = bluetoothAdapter
                if (adapter == null) {
                    promise.reject("BT_NOT_SUPPORTED", "Bluetooth not supported on this device")
                    return@withContext
                }
                if (!adapter.isEnabled) {
                    promise.reject("BT_DISABLED", "Bluetooth is disabled")
                    return@withContext
                }

                // Cancel any in-progress scan first
                stopScan()

                pairedDevices.clear()
                foundDevices.clear()

                // Collect already-paired devices
                try {
                    adapter.bondedDevices?.forEach { device ->
                        pairedDevices.add(device.toDeviceInfo())
                    }
                } catch (e: SecurityException) {
                    Log.w(TAG, "[Native:Android] DeviceScanner: Cannot read bonded devices — ${e.message}")
                }

                // CompletableDeferred resolves when ACTION_DISCOVERY_FINISHED fires
                val finished = CompletableDeferred<Unit>()

                receiver = object : BroadcastReceiver() {
                    override fun onReceive(ctx: Context, intent: Intent) {
                        when (intent.action) {
                            BluetoothDevice.ACTION_FOUND -> handleDeviceFound(intent)
                            BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> {
                                if (!finished.isCompleted) finished.complete(Unit)
                            }
                        }
                    }
                }

                val filter = IntentFilter().apply {
                    addAction(BluetoothDevice.ACTION_FOUND)
                    addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
                }
                reactContext.registerReceiver(receiver, filter)

                // Start discovery
                val started = try {
                    adapter.cancelDiscovery()
                    adapter.startDiscovery()
                } catch (e: SecurityException) {
                    unregisterReceiver()
                    promise.reject("BT_PERMISSION", "Missing BLUETOOTH_SCAN permission: ${e.message}")
                    return@withContext
                }

                if (!started) {
                    unregisterReceiver()
                    promise.reject("SCAN_FAILED", "startDiscovery returned false — check permissions and location")
                    return@withContext
                }

                isScanning = true

                // Wait for discovery to finish (or timeout after 15 s)
                withTimeoutOrNull(SCAN_TIMEOUT_MS) { finished.await() }

                isScanning = false
                unregisterReceiver()

                try {
                    adapter.cancelDiscovery()
                } catch (e: SecurityException) { /* ignore */ }

                promise.resolve(buildResult())
                Log.d(TAG, "[Native:Android] DeviceScanner.scanDevices SUCCESS: paired=${pairedDevices.size} found=${foundDevices.size}")
            } catch (e: Exception) {
                Log.e(TAG, "[Native:Android] DeviceScanner.scanDevices ERROR: ${e.message}", e)
                promise.reject("SCAN_ERROR", e.message, e)
            }
        }
    }

    /** Stop an in-progress scan. Safe to call when not scanning. */
    fun stopScan() {
        isScanning = false
        unregisterReceiver()
        try {
            bluetoothAdapter?.cancelDiscovery()
        } catch (e: SecurityException) { /* ignore */ }
        Log.d(TAG, "[Native:Android] DeviceScanner.stopScan")
    }

    fun isCurrentlyScanning(): Boolean = isScanning

    // ---- Private helpers ----

    private fun handleDeviceFound(intent: Intent) {
        val device: BluetoothDevice? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
        } ?: return

        // Skip already-bonded (they're in pairedDevices)
        val btDevice = device ?: return
        if (btDevice.bondState == BluetoothDevice.BOND_BONDED) return

        val rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, 0).toInt()
        val info = btDevice.toDeviceInfo(rssi)

        if (foundDevices.none { it.address == info.address }) {
            foundDevices.add(info)
            Log.d(TAG, "[Native:Android] DeviceScanner device found: ${info.name} (${info.address})")
        }
    }

    private fun buildResult(): WritableMap {
        val result = Arguments.createMap()

        val pairedArray = Arguments.createArray()
        pairedDevices.forEach { d ->
            pairedArray.pushMap(d.toWritableMap())
        }

        val foundArray = Arguments.createArray()
        foundDevices.forEach { d ->
            foundArray.pushMap(d.toWritableMap())
        }

        result.putArray("paired", pairedArray)
        result.putArray("found", foundArray)
        return result
    }

    private fun unregisterReceiver() {
        receiver?.let {
            try { reactContext.unregisterReceiver(it) } catch (e: Exception) { /* ignore */ }
            receiver = null
        }
    }

    private fun BluetoothDevice.toDeviceInfo(rssi: Int = 0): DeviceInfo {
        val deviceName = try { name ?: "" } catch (e: SecurityException) { "" }
        val type = when (type) {
            BluetoothDevice.DEVICE_TYPE_LE -> "ble"
            BluetoothDevice.DEVICE_TYPE_CLASSIC -> "bt"
            BluetoothDevice.DEVICE_TYPE_DUAL -> "dual"
            else -> "unknown"
        }
        return DeviceInfo(
            name = deviceName.ifEmpty { "Unknown Device" },
            address = address,
            deviceType = type,
            rssi = rssi
        )
    }

    private fun DeviceInfo.toWritableMap(): WritableMap {
        val map = Arguments.createMap()
        map.putString("name", name)
        map.putString("address", address)
        map.putString("deviceType", deviceType)
        map.putInt("rssi", rssi)
        return map
    }
}
