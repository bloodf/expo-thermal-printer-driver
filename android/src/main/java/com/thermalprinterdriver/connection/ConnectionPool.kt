package com.thermalprinterdriver.connection

import android.content.Context
import android.util.Log
import com.thermalprinterdriver.transport.Transport
import com.thermalprinterdriver.transport.TransportFactory
import java.util.Timer
import java.util.TimerTask
import java.util.concurrent.ConcurrentHashMap

/**
 * Connection pool that reuses live [Transport] instances keyed by address.
 *
 * A background [Timer] checks every 10 seconds and closes connections that have been
 * idle for more than 30 seconds.
 */
class ConnectionPool(private val context: Context) {

    companion object {
        private const val TAG = "ConnectionPool"
        private const val IDLE_THRESHOLD_MS = 30_000L
        private const val SWEEP_INTERVAL_MS = 10_000L
    }

    private val pool = ConcurrentHashMap<String, ConnectionEntry>()

    private val sweepTimer = Timer("ConnectionPool-sweep", true).also { timer ->
        timer.scheduleAtFixedRate(object : TimerTask() {
            override fun run() { sweepIdle() }
        }, SWEEP_INTERVAL_MS, SWEEP_INTERVAL_MS)
    }

    /**
     * Returns an existing live connection or creates (and connects) a new one.
     * Returns null if the connection could not be established.
     */
    suspend fun getOrCreate(address: String): Transport? {
        pool[address]?.let { entry ->
            if (entry.transport.isConnected()) {
                entry.lastUsed = System.currentTimeMillis()
                Log.d(TAG, "[Native:Android] ConnectionPool.getOrCreate REUSE: $address")
                return entry.transport
            }
            // Stale entry — clean up
            pool.remove(address)
            entry.transport.close()
        }

        return try {
            val transport = TransportFactory.create(address, context)
            transport.connect()
            pool[address] = ConnectionEntry(transport)
            Log.d(TAG, "[Native:Android] ConnectionPool.getOrCreate CREATED: $address")
            transport
        } catch (e: Exception) {
            Log.e(TAG, "[Native:Android] ConnectionPool.getOrCreate FAILED: $address — ${e.message}")
            null
        }
    }

    /** Close and remove a specific connection. */
    fun close(address: String) {
        pool.remove(address)?.transport?.close()
        Log.d(TAG, "[Native:Android] ConnectionPool.close: $address")
    }

    /** Close all pooled connections. */
    fun closeAll() {
        pool.values.forEach { entry ->
            try { entry.transport.close() } catch (e: Exception) { /* ignore */ }
        }
        pool.clear()
        Log.d(TAG, "[Native:Android] ConnectionPool.closeAll")
    }

    /** Cancel the sweep timer and close all connections. */
    fun shutdown() {
        sweepTimer.cancel()
        closeAll()
    }

    private fun sweepIdle() {
        val threshold = System.currentTimeMillis() - IDLE_THRESHOLD_MS
        val toRemove = pool.entries.filter { it.value.lastUsed < threshold }
        toRemove.forEach { (addr, entry) ->
            pool.remove(addr)
            try { entry.transport.close() } catch (e: Exception) { /* ignore */ }
            Log.d(TAG, "[Native:Android] ConnectionPool.sweep CLOSED idle: $addr")
        }
    }
}
