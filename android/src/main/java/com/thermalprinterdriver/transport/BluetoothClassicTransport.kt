package com.thermalprinterdriver.transport

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothSocket
import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import java.io.IOException
import java.util.UUID

/**
 * Bluetooth Classic (RFCOMM/SPP) transport.
 * Uses UUID 00001101-0000-1000-8000-00805F9B34FB.
 * Data is sent in 512-byte chunks with a 35 ms inter-chunk delay.
 */
class BluetoothClassicTransport(private val macAddress: String) : Transport {

    companion object {
        private const val TAG = "BtClassicTransport"
        private val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
        private const val CHUNK_SIZE = 512
        private const val CHUNK_DELAY_MS = 35L
    }

    private var socket: BluetoothSocket? = null

    override suspend fun connect(): Unit = withContext(Dispatchers.IO) {
        Log.d(TAG, "[Native:Android] BluetoothClassicTransport.connect START: $macAddress")
        try {
            socket?.close()
            socket = null

            val adapter = BluetoothAdapter.getDefaultAdapter()
                ?: throw IOException("Bluetooth not supported on this device")

            if (!adapter.isEnabled) {
                throw IOException("Bluetooth is disabled")
            }

            adapter.cancelDiscovery()
            val device = adapter.getRemoteDevice(macAddress)

            var newSocket: BluetoothSocket? = null
            try {
                newSocket = device.createRfcommSocketToServiceRecord(SPP_UUID)
                newSocket.connect()
            } catch (e: IOException) {
                Log.w(TAG, "[Native:Android] BluetoothClassicTransport.connect FALLBACK: ${e.message}")
                newSocket?.close()
                // Fallback: insecure channel via reflection
                val method = device.javaClass.getMethod(
                    "createInsecureRfcommSocketToServiceRecord",
                    UUID::class.java
                )
                newSocket = method.invoke(device, SPP_UUID) as BluetoothSocket
                newSocket.connect()
            }

            socket = newSocket
            Log.d(TAG, "[Native:Android] BluetoothClassicTransport.connect SUCCESS: $macAddress")
        } catch (e: SecurityException) {
            throw IOException("Missing Bluetooth permission: ${e.message}", e)
        }
    }

    override suspend fun write(data: ByteArray): Unit = withContext(Dispatchers.IO) {
        val out = socket?.outputStream ?: throw IOException("Not connected to $macAddress")
        var offset = 0
        while (offset < data.size) {
            val end = minOf(offset + CHUNK_SIZE, data.size)
            out.write(data, offset, end - offset)
            offset = end
            if (offset < data.size) {
                delay(CHUNK_DELAY_MS)
            }
        }
        out.flush()
        Log.d(TAG, "[Native:Android] BluetoothClassicTransport.write SUCCESS: ${data.size} bytes to $macAddress")
    }

    override fun close() {
        try {
            socket?.close()
            Log.d(TAG, "[Native:Android] BluetoothClassicTransport.close: $macAddress")
        } catch (e: Exception) {
            Log.w(TAG, "[Native:Android] BluetoothClassicTransport.close WARN: ${e.message}")
        } finally {
            socket = null
        }
    }

    override fun isConnected(): Boolean = socket?.isConnected == true
}
