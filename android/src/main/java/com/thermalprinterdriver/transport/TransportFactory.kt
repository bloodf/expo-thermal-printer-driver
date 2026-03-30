package com.thermalprinterdriver.transport

import android.content.Context
import java.io.IOException

/**
 * Creates the appropriate [Transport] from an address string.
 *
 * Address formats:
 *  - bt:<MAC>           — Bluetooth Classic (RFCOMM/SPP)
 *  - ble:<MAC>          — Bluetooth Low Energy (GATT)
 *  - lan:<HOST>:<PORT>  — TCP/LAN (port defaults to 9100)
 */
object TransportFactory {

    fun create(address: String, context: Context? = null): Transport {
        val colonIdx = address.indexOf(':')
        if (colonIdx < 0) throw IOException("Invalid address format: $address")

        val scheme = address.substring(0, colonIdx)
        val target = address.substring(colonIdx + 1)

        return when (scheme) {
            "bt" -> BluetoothClassicTransport(target)
            "ble" -> {
                val ctx = context ?: throw IOException("Context required for BLE transport")
                BleTransport(ctx, target)
            }
            "lan" -> {
                val parts = target.split(":")
                val host = parts[0]
                val port = parts.getOrNull(1)?.toIntOrNull() ?: 9100
                TcpTransport(host, port)
            }
            else -> throw IOException("Unknown transport scheme '$scheme' in address: $address")
        }
    }
}
