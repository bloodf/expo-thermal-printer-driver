package com.thermalprinterdriver.transport

/**
 * Transport interface — abstracts the physical connection to a printer.
 * All implementations must be safe to call from a coroutine context.
 */
interface Transport {
    /** Establish the connection. Throws on failure. */
    suspend fun connect()

    /** Write raw bytes to the printer. */
    suspend fun write(data: ByteArray)

    /** Close the connection and release resources. */
    fun close()

    /** Returns true if the connection is currently active. */
    fun isConnected(): Boolean
}
