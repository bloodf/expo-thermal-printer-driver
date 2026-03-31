# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — 2026-03-31

### Added

- Initial public release
- TurboModule with New Architecture (Codegen + JSI) support
- `ThermalPrinter.scan()` — discover Bluetooth Classic, BLE, and TCP printers
- `ThermalPrinter.connect()` / `ThermalPrinter.disconnect()` — connection management over BT, BLE, and TCP
- `ThermalPrinter.print()` — high-level document printing with composable nodes
- `ThermalPrinter.printRaw()` — send raw ESC/POS bytes directly
- Document node API: `text`, `qr`, `barcode`, `image`, `columns`, `table`, `feed`, `cut`, `raw`, `line`, `spacer`
- `ESCPOSBuilder` — fluent low-level API for building raw command sequences
- Floyd-Steinberg image dithering for monochrome receipt printing
- QR codes (model 2) with configurable size and error correction
- Barcode support: UPC_A, UPC_E, EAN13, EAN8, CODE39, ITF, CODABAR, CODE93, CODE128
- Multi-column text layout with alignment
- Table printing with header and border styles
- 58mm and 80mm paper width support
- Expo config plugin (`app.plugin.js`) for `app.json` integration
- iOS CocoaPods native module (Swift + Objective-C)
- Android Kotlin native module with Kotlin coroutines
- TypeScript source with full type definitions
- ESLint + Prettier formatting
- Jest test suite

### Supported Environments

| Platform | Transports                  |
| -------- | --------------------------- |
| Android  | Bluetooth Classic, BLE, TCP |
| iOS      | BLE, TCP                    |
