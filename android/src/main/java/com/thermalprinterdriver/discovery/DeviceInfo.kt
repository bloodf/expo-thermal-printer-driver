package com.thermalprinterdriver.discovery

/**
 * Represents a discovered or paired Bluetooth printer device.
 */
data class DeviceInfo(
    val name: String,
    val address: String,
    val deviceType: String,  // "bt", "ble", "dual", "unknown"
    val rssi: Int = 0
)
