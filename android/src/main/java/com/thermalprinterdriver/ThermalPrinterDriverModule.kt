package com.thermalprinterdriver

import com.facebook.react.bridge.ReactApplicationContext

class ThermalPrinterDriverModule(reactContext: ReactApplicationContext) :
  NativeThermalPrinterDriverSpec(reactContext) {

  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }

  companion object {
    const val NAME = NativeThermalPrinterDriverSpec.NAME
  }
}
