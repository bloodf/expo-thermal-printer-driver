package com.thermalprinterdriver.transport

import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.content.Context
import android.os.Build
import android.util.Log
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.io.IOException
import kotlin.coroutines.resume

/**
 * BLE transport using BluetoothGatt.
 * Requests 512-byte MTU, then sends data in negotiated-MTU-3 chunks with 20 ms delays.
 */
class BleTransport(
    private val context: Context,
    private val deviceAddress: String
) : Transport {

    companion object {
        private const val TAG = "BleTransport"
        private const val CHUNK_DELAY_MS = 20L
        private const val DEFAULT_MTU = 23
        private const val DESIRED_MTU = 512
    }

    private var gatt: BluetoothGatt? = null
    private var writeCharacteristic: BluetoothGattCharacteristic? = null
    @Volatile private var connected = false
    private var negotiatedMtu: Int = DEFAULT_MTU

    override suspend fun connect(): Unit = withContext(Dispatchers.IO) {
        Log.d(TAG, "[Native:Android] BleTransport.connect START: $deviceAddress")
        try {
            gatt?.close()
            gatt = null
            connected = false

            val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager
                ?: throw IOException("Bluetooth LE not supported")
            val adapter = bluetoothManager.adapter
            if (!adapter.isEnabled) throw IOException("Bluetooth is disabled")

            val device = adapter.getRemoteDevice(deviceAddress)

            val success = suspendCancellableCoroutine { cont: CancellableContinuation<Boolean> ->
                val callback = object : BluetoothGattCallback() {
                    override fun onConnectionStateChange(g: BluetoothGatt?, status: Int, newState: Int) {
                        when (newState) {
                            BluetoothProfile.STATE_CONNECTED -> {
                                Log.d(TAG, "[Native:Android] BleTransport CONNECTED, discovering services")
                                g?.requestMtu(DESIRED_MTU)
                            }
                            BluetoothProfile.STATE_DISCONNECTED -> {
                                connected = false
                                if (cont.isActive) cont.resume(false)
                            }
                        }
                    }

                    override fun onMtuChanged(g: BluetoothGatt?, mtu: Int, status: Int) {
                        negotiatedMtu = if (status == BluetoothGatt.GATT_SUCCESS) mtu else DEFAULT_MTU
                        Log.d(TAG, "[Native:Android] BleTransport MTU negotiated: $negotiatedMtu")
                        g?.discoverServices()
                    }

                    override fun onServicesDiscovered(g: BluetoothGatt?, status: Int) {
                        if (status != BluetoothGatt.GATT_SUCCESS) {
                            if (cont.isActive) cont.resume(false)
                            return
                        }
                        val characteristic = g?.services
                            ?.flatMap { it.characteristics }
                            ?.firstOrNull { char ->
                                (char.properties and BluetoothGattCharacteristic.PROPERTY_WRITE != 0) ||
                                (char.properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0)
                            }
                        if (characteristic != null) {
                            writeCharacteristic = characteristic
                            connected = true
                            Log.d(TAG, "[Native:Android] BleTransport write char found: ${characteristic.uuid}")
                            if (cont.isActive) cont.resume(true)
                        } else {
                            Log.e(TAG, "[Native:Android] BleTransport no write characteristic found")
                            if (cont.isActive) cont.resume(false)
                        }
                    }
                }

                gatt = device.connectGatt(context, false, callback)
                cont.invokeOnCancellation { gatt?.close() }
            }

            if (!success) {
                gatt?.close()
                gatt = null
                throw IOException("BLE connection failed to $deviceAddress")
            }
            Log.d(TAG, "[Native:Android] BleTransport.connect SUCCESS: $deviceAddress")
        } catch (e: SecurityException) {
            throw IOException("Missing Bluetooth permission: ${e.message}", e)
        }
    }

    override suspend fun write(data: ByteArray): Unit = withContext(Dispatchers.IO) {
        val g = gatt ?: throw IOException("Not connected to $deviceAddress")
        val char = writeCharacteristic ?: throw IOException("No write characteristic for $deviceAddress")
        val chunkSize = (negotiatedMtu - 3).coerceAtLeast(20)

        var offset = 0
        while (offset < data.size) {
            val end = minOf(offset + chunkSize, data.size)
            val chunk = data.copyOfRange(offset, end)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val writeType = if (char.properties and BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE != 0) {
                    BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE
                } else {
                    BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
                }
                g.writeCharacteristic(char, chunk, writeType)
            } else {
                @Suppress("DEPRECATION")
                char.value = chunk
                @Suppress("DEPRECATION")
                g.writeCharacteristic(char)
            }

            offset = end
            if (offset < data.size) {
                delay(CHUNK_DELAY_MS)
            }
        }
        Log.d(TAG, "[Native:Android] BleTransport.write SUCCESS: ${data.size} bytes to $deviceAddress")
    }

    override fun close() {
        try {
            gatt?.close()
            Log.d(TAG, "[Native:Android] BleTransport.close: $deviceAddress")
        } catch (e: Exception) {
            Log.w(TAG, "[Native:Android] BleTransport.close WARN: ${e.message}")
        } finally {
            gatt = null
            writeCharacteristic = null
            connected = false
        }
    }

    override fun isConnected(): Boolean = connected && gatt != null
}
