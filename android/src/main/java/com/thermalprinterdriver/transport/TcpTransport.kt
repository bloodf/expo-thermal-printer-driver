package com.thermalprinterdriver.transport

import android.util.Log
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.IOException
import java.net.InetSocketAddress
import java.net.Socket

/**
 * TCP/LAN transport using java.net.Socket.
 * Default port 9100 (ESC/POS standard). Timeout is configurable.
 */
class TcpTransport(
    private val host: String,
    private val port: Int = 9100,
    private val connectTimeoutMs: Int = 5000
) : Transport {

    companion object {
        private const val TAG = "TcpTransport"
    }

    private var socket: Socket? = null

    override suspend fun connect(): Unit = withContext(Dispatchers.IO) {
        Log.d(TAG, "[Native:Android] TcpTransport.connect START: $host:$port")
        try {
            socket?.close()
            socket = null
            val newSocket = Socket().apply {
                soTimeout = connectTimeoutMs
                tcpNoDelay = true
                reuseAddress = true
            }
            newSocket.connect(InetSocketAddress(host, port), connectTimeoutMs)
            socket = newSocket
            Log.d(TAG, "[Native:Android] TcpTransport.connect SUCCESS: $host:$port")
        } catch (e: Exception) {
            throw IOException("TCP connection failed to $host:$port: ${e.message}", e)
        }
    }

    override suspend fun write(data: ByteArray): Unit = withContext(Dispatchers.IO) {
        val out = socket?.getOutputStream() ?: throw IOException("Not connected to $host:$port")
        out.write(data)
        out.flush()
        Log.d(TAG, "[Native:Android] TcpTransport.write SUCCESS: ${data.size} bytes to $host:$port")
    }

    override fun close() {
        try {
            socket?.close()
            Log.d(TAG, "[Native:Android] TcpTransport.close: $host:$port")
        } catch (e: Exception) {
            Log.w(TAG, "[Native:Android] TcpTransport.close WARN: ${e.message}")
        } finally {
            socket = null
        }
    }

    override fun isConnected(): Boolean {
        val s = socket ?: return false
        return s.isConnected && !s.isClosed
    }
}
