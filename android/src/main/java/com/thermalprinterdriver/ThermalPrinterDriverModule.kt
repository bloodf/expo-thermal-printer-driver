package com.thermalprinterdriver

import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.thermalprinterdriver.connection.ConnectionPool
import com.thermalprinterdriver.discovery.DeviceScanner
import com.thermalprinterdriver.image.ImageProcessor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * TurboModule implementation for ThermalPrinterDriver.
 * Extends the codegen-generated [NativeThermalPrinterDriverSpec].
 */
class ThermalPrinterDriverModule(reactContext: ReactApplicationContext) :
    NativeThermalPrinterDriverSpec(reactContext) {

    companion object {
        const val NAME = NativeThermalPrinterDriverSpec.NAME
        private const val TAG = "ThermalPrinterDriver"

        // Event names emitted to JS
        const val EVENT_DEVICE_FOUND = "onDeviceFound"
        const val EVENT_SCAN_COMPLETED = "onScanCompleted"
        const val EVENT_CONNECTION_CHANGED = "onConnectionChanged"
    }

    private val moduleScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    private val deviceScanner = DeviceScanner(reactContext)
    private val connectionPool = ConnectionPool(reactContext)

    // ---- NativeModule identity ----

    override fun getName(): String = NAME

    // ---- Discovery ----

    override fun scanDevices(promise: Promise) {
        Log.d(TAG, "[Native:Android] scanDevices START")
        moduleScope.launch {
            deviceScanner.scanDevices(promise)
        }
    }

    override fun stopScan(promise: Promise) {
        Log.d(TAG, "[Native:Android] stopScan")
        try {
            deviceScanner.stopScan()
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e(TAG, "[Native:Android] stopScan ERROR: ${e.message}", e)
            promise.reject("STOP_SCAN_ERROR", e.message, e)
        }
    }

    // ---- Connection ----

    override fun connect(address: String, timeout: Double, promise: Promise) {
        Log.d(TAG, "[Native:Android] connect START: $address")
        moduleScope.launch {
            try {
                val transport = withContext(Dispatchers.IO) {
                    connectionPool.getOrCreate(address)
                }
                if (transport == null) {
                    val result = Arguments.createMap()
                    result.putBoolean("success", false)
                    val errorMap = Arguments.createMap()
                    errorMap.putString("code", "CONNECTION_FAILED")
                    errorMap.putString("message", "Connection failed to $address")
                    errorMap.putBoolean("retryable", true)
                    result.putMap("error", errorMap)
                    promise.resolve(result)
                } else {
                    emitOnConnectionChanged(address, "connected")
                    val result = Arguments.createMap()
                    result.putBoolean("success", true)
                    result.putString("address", address)
                    promise.resolve(result)
                }
            } catch (e: Exception) {
                Log.e(TAG, "[Native:Android] connect ERROR: ${e.message}", e)
                val result = Arguments.createMap()
                result.putBoolean("success", false)
                val errorMap = Arguments.createMap()
                errorMap.putString("code", "CONNECTION_FAILED")
                errorMap.putString("message", e.message ?: "Connection failed")
                errorMap.putBoolean("retryable", true)
                result.putMap("error", errorMap)
                promise.resolve(result)
            }
        }
    }

    override fun disconnect(address: String?, promise: Promise) {
        Log.d(TAG, "[Native:Android] disconnect: ${address ?: "all"}")
        try {
            if (address.isNullOrEmpty()) {
                connectionPool.closeAll()
            } else {
                connectionPool.close(address)
                emitOnConnectionChanged(address, "disconnected")
            }
            promise.resolve(null)
        } catch (e: Exception) {
            Log.e(TAG, "[Native:Android] disconnect ERROR: ${e.message}", e)
            promise.reject("DISCONNECT_ERROR", e.message, e)
        }
    }

    override fun testConnection(address: String, promise: Promise) {
        Log.d(TAG, "[Native:Android] testConnection: $address")
        moduleScope.launch {
            try {
                val transport = withContext(Dispatchers.IO) {
                    connectionPool.getOrCreate(address)
                }
                val result = Arguments.createMap()
                if (transport != null && transport.isConnected()) {
                    result.putBoolean("success", true)
                    result.putString("address", address)
                } else {
                    result.putBoolean("success", false)
                    result.putString("error", "Cannot reach printer at $address")
                }
                promise.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "[Native:Android] testConnection ERROR: ${e.message}", e)
                val result = Arguments.createMap()
                result.putBoolean("success", false)
                result.putString("error", e.message ?: "Test failed")
                promise.resolve(result)
            }
        }
    }

    // ---- Printing ----

    override fun printRaw(
        address: String,
        data: ReadableArray,
        keepAlive: Boolean,
        timeout: Double,
        promise: Promise
    ) {
        Log.d(TAG, "[Native:Android] printRaw START: addr=$address size=${data.size()}")
        moduleScope.launch {
            try {
                val bytes = ByteArray(data.size()) { i -> data.getInt(i).toByte() }

                val result = withContext(Dispatchers.IO) {
                    val transport = connectionPool.getOrCreate(address)
                        ?: return@withContext buildError("Connection failed to $address")

                    try {
                        transport.write(bytes)
                        if (!keepAlive) {
                            connectionPool.close(address)
                        }
                        buildSuccess()
                    } catch (e: Exception) {
                        connectionPool.close(address)
                        buildError(e.message ?: "Send failed")
                    }
                }
                promise.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "[Native:Android] printRaw ERROR: ${e.message}", e)
                promise.resolve(buildError(e.message ?: "Print failed"))
            }
        }
    }

    override fun printImage(
        address: String,
        source: String,
        sourceType: String,
        widthPx: Double,
        align: Double,
        keepAlive: Boolean,
        timeout: Double,
        promise: Promise
    ) {
        Log.d(TAG, "[Native:Android] printImage START: addr=$address type=$sourceType width=$widthPx")
        moduleScope.launch {
            try {
                val result = withContext(Dispatchers.IO) {
                    val rasterData = try {
                        ImageProcessor.process(
                            source = source,
                            sourceType = sourceType,
                            widthPx = widthPx.toInt().coerceAtLeast(1),
                            align = align.toInt().coerceIn(0, 2)
                        )
                    } catch (e: Exception) {
                        return@withContext buildError("Image processing failed: ${e.message}")
                    }

                    val transport = connectionPool.getOrCreate(address)
                        ?: return@withContext buildError("Connection failed to $address")

                    try {
                        transport.write(rasterData)
                        if (!keepAlive) {
                            connectionPool.close(address)
                        }
                        buildSuccess()
                    } catch (e: Exception) {
                        connectionPool.close(address)
                        buildError(e.message ?: "Send failed")
                    }
                }
                promise.resolve(result)
            } catch (e: Exception) {
                Log.e(TAG, "[Native:Android] printImage ERROR: ${e.message}", e)
                promise.resolve(buildError(e.message ?: "Print image failed"))
            }
        }
    }

    // ---- Event boilerplate (required by NativeEventEmitter) ----

    override fun addListener(eventName: String) {
        // No-op: required by NativeEventEmitter protocol
    }

    override fun removeListeners(count: Double) {
        // No-op: required by NativeEventEmitter protocol
    }

    // ---- Event emitters ----

    private fun emitOnDeviceFound(deviceMap: com.facebook.react.bridge.WritableMap) {
        getReactApplicationContext()
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_DEVICE_FOUND, deviceMap)
    }

    private fun emitOnScanCompleted(resultMap: com.facebook.react.bridge.WritableMap) {
        getReactApplicationContext()
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_SCAN_COMPLETED, resultMap)
    }

    private fun emitOnConnectionChanged(address: String, state: String) {
        val params = Arguments.createMap()
        params.putString("address", address)
        params.putString("state", state)
        getReactApplicationContext()
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_CONNECTION_CHANGED, params)
    }

    // ---- Lifecycle ----

    override fun invalidate() {
        super.invalidate()
        Log.d(TAG, "[Native:Android] invalidate: cleanup")
        moduleScope.cancel()
        connectionPool.shutdown()
    }

    // ---- Helpers ----

    private fun buildSuccess(): com.facebook.react.bridge.WritableMap {
        val map = Arguments.createMap()
        map.putBoolean("success", true)
        return map
    }

    private fun buildError(message: String): com.facebook.react.bridge.WritableMap {
        val map = Arguments.createMap()
        map.putBoolean("success", false)
        map.putString("error", message)
        return map
    }
}
