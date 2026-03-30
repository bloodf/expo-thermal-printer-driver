package com.thermalprinterdriver.connection

import com.thermalprinterdriver.transport.Transport

/**
 * A pooled connection entry holding a live [Transport] and the last-used timestamp.
 */
data class ConnectionEntry(
    val transport: Transport,
    var lastUsed: Long = System.currentTimeMillis()
)
