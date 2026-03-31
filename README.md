# react-native-thermal-printer-driver

A React Native TurboModule for thermal receipt printers over **Bluetooth Classic**, **BLE**, and **TCP/LAN**. Built with the New Architecture (Codegen + JSI) for maximum performance.

Supports ESC/POS text formatting, image printing with Floyd-Steinberg dithering, QR codes, barcodes, tables, and more — on both Android and iOS.

## Features

| Feature | Android | iOS |
|---------|:-------:|:---:|
| Bluetooth Classic | Yes | - |
| BLE (Bluetooth Low Energy) | Yes | Yes |
| TCP/LAN (Wi-Fi printers) | Yes | Yes |
| Text with styles (bold, underline, alignment) | Yes | Yes |
| Image printing (URL, file, base64) | Yes | Yes |
| QR codes | Yes | Yes |
| Barcodes (9 formats) | Yes | Yes |
| Tables and columns | Yes | Yes |
| Paper cut | Yes | Yes |
| Cash drawer | Yes | Yes |
| Floyd-Steinberg dithering | Yes | Yes |
| 58mm and 80mm paper | Yes | Yes |

> **Note:** Bluetooth Classic is not available on iOS due to Apple platform restrictions. Use BLE or TCP printers on iOS.

## Installation

```bash
npm install react-native-thermal-printer-driver
# or
yarn add react-native-thermal-printer-driver
```

### Expo

Add the plugin to your `app.json` or `app.config.js`:

```json
{
  "expo": {
    "plugins": ["react-native-thermal-printer-driver"]
  }
}
```

Then rebuild your development client:

```bash
npx expo prebuild --clean
```

> This library requires a **custom development build** — it will not work with Expo Go.

### Bare React Native

```bash
cd ios && pod install
```

Android permissions are added automatically via the library's `AndroidManifest.xml`.

## Quick Start

```typescript
import ThermalPrinter, { text, image, qr, line, cut, feed } from 'react-native-thermal-printer-driver';

// 1. Scan for printers
const { paired, found } = await ThermalPrinter.scan();
console.log('Found printers:', [...paired, ...found]);

// 2. Connect
const printer = paired[0];
await ThermalPrinter.connect(printer.address, { timeout: 10000 });

// 3. Print a receipt
await ThermalPrinter.print(printer.address, [
  text('MY STORE', { align: 'center', bold: true, size: 2 }),
  line(),
  text('Espresso x2          $7.00'),
  text('Croissant x1         $3.50'),
  line({ style: 'dashed' }),
  text('TOTAL               $10.50', { bold: true }),
  feed(1),
  qr('https://mystore.com/receipt/12345', { size: 6 }),
  feed(3),
  cut(),
]);

// 4. Disconnect
await ThermalPrinter.disconnect(printer.address);
```

## API Reference

### Discovery

#### `scan(): Promise<ScanResult>`

Scans for nearby Bluetooth and BLE printers. Returns paired and discovered devices.

```typescript
const { paired, found } = await ThermalPrinter.scan();
```

**Returns:**

```typescript
interface ScanResult {
  paired: Device[];  // Previously paired Bluetooth devices
  found: Device[];   // Newly discovered devices (BLE/Classic)
}

interface Device {
  name: string;
  address: string;
  deviceType: 'bt' | 'ble' | 'dual' | 'unknown';
  rssi?: number;  // Signal strength (BLE only)
}
```

#### `stopScan(): Promise<void>`

Stops an active device scan.

#### `onDeviceFound(callback): Subscription`

Subscribe to real-time device discovery events during a scan.

```typescript
const subscription = ThermalPrinter.onDeviceFound((device) => {
  console.log('Found:', device.name, device.address);
});

// Later: subscription.remove();
```

#### `onScanCompleted(callback): Subscription`

Fires when a scan finishes.

#### `onConnectionChanged(callback): Subscription`

Fires when a printer connects or disconnects.

```typescript
ThermalPrinter.onConnectionChanged(({ address, connected }) => {
  console.log(connected ? 'Connected' : 'Disconnected', address);
});
```

---

### Connection

#### `connect(address, options?): Promise<void>`

Connects to a printer. The address format determines the transport:

| Format | Transport |
|--------|-----------|
| `bt:XX:XX:XX:XX:XX:XX` | Bluetooth Classic |
| `ble:UUID` or `ble:XX:XX:XX:XX:XX:XX` | BLE |
| `tcp:192.168.1.100:9100` | TCP/LAN |

```typescript
await ThermalPrinter.connect('bt:86:67:7A:CA:30:D8', { timeout: 10000 });
```

**Options:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `timeout` | `number` | `10000` | Connection timeout in ms |

#### `disconnect(address?): Promise<void>`

Disconnects from a printer. Pass no arguments to disconnect all.

```typescript
await ThermalPrinter.disconnect('bt:86:67:7A:CA:30:D8');
// or disconnect all:
await ThermalPrinter.disconnect();
```

#### `isConnected(address): Promise<boolean>`

Quick connection check.

#### `testConnection(address): Promise<TestResult>`

Full connection test with device info.

```typescript
const result = await ThermalPrinter.testConnection('bt:86:67:7A:CA:30:D8');
// { success: true, deviceName: 'MPT-II_30D8' }
```

---

### Printing

#### `print(address, nodes, options?): Promise<PrintResult>`

Prints a document composed of nodes. This is the high-level API.

```typescript
const result = await ThermalPrinter.print(address, [
  text('Hello World', { align: 'center', bold: true }),
  image({ url: 'https://example.com/logo.png', width: 384 }),
  qr('https://example.com'),
  cut(),
]);
```

**Options:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `paperWidthMm` | `58 \| 80` | `58` | Paper width in mm |
| `codePage` | `CodePage` | `'utf-8'` | Text encoding |
| `keepAlive` | `boolean` | `false` | Keep connection after print |
| `timeout` | `number` | `15000` | Print timeout in ms |
| `copies` | `number` | `1` | Number of copies |
| `disableCutPaper` | `boolean` | `false` | Skip auto paper cut |

#### `printRaw(address, bytes, options?): Promise<PrintResult>`

Send raw ESC/POS bytes directly. Use with the `ESCPOSBuilder` for full control.

```typescript
import { ESCPOSBuilder } from 'react-native-thermal-printer-driver';

const builder = new ESCPOSBuilder();
const bytes = builder
  .init()
  .align('center')
  .bold(true)
  .text('RECEIPT\n')
  .bold(false)
  .align('left')
  .text('Item 1        $5.00\n')
  .feed(3)
  .cut()
  .bytes();

await ThermalPrinter.printRaw(address, bytes, { timeout: 10000 });
```

---

### Document Nodes

Build receipts using composable node functions:

#### `text(content, style?)`

```typescript
text('Hello World')
text('TOTAL: $10.50', { align: 'right', bold: true, size: 2 })
```

**TextStyle options:**

| Property | Type | Description |
|----------|------|-------------|
| `align` | `'left' \| 'center' \| 'right'` | Text alignment |
| `bold` | `boolean` | Bold text |
| `underline` | `boolean \| 'single' \| 'double'` | Underline text |
| `doubleStrike` | `boolean` | Double strike effect |
| `reverse` | `boolean` | Inverted colors (white on black) |
| `size` | `1-8` | Text size multiplier |
| `widthScale` | `1-8` | Horizontal scale only |
| `heightScale` | `1-8` | Vertical scale only |
| `font` | `'A' \| 'B'` | Printer font (A=12x24, B=9x17) |

#### `image(source)`

Prints an image. The native module handles downloading, resizing, and Floyd-Steinberg dithering to 1-bit monochrome.

```typescript
// From URL
image({ url: 'https://example.com/logo.png', width: 384 })

// From file
image({ uri: '/path/to/image.png', width: 384 })

// From base64
image({ base64: 'iVBORw0KGgo...', width: 384 })
```

**Width reference:** 384px for 58mm paper, 576px for 80mm paper.

#### `qr(content, options?)`

```typescript
qr('https://example.com', { size: 6, errorLevel: 'M' })
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `size` | `number` | `5` | Module size (1-16) |
| `errorLevel` | `'L' \| 'M' \| 'Q' \| 'H'` | `'M'` | Error correction level |

#### `barcode(content, options)`

```typescript
barcode('4006381333931', { format: 'EAN13', height: 80, hri: 'below' })
```

**Supported formats:** `UPC_A`, `UPC_E`, `EAN13`, `EAN8`, `CODE39`, `ITF`, `CODABAR`, `CODE93`, `CODE128`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `format` | `BarcodeFormat` | required | Barcode symbology |
| `height` | `number` | `80` | Bar height in dots |
| `width` | `number` | `2` | Bar width (1-6) |
| `hri` | `string` | `'below'` | Human-readable position |

#### `line(options?)`

Prints a horizontal rule.

```typescript
line()                          // ================================
line({ style: 'dashed' })      // --------------------------------
line({ character: '*' })        // ********************************
```

#### `columns(defs)`

Multi-column layout for aligned text.

```typescript
columns([
  { content: 'Item', width: 20, align: 'left' },
  { content: '$5.00', width: 12, align: 'right' },
])
```

#### `table(def)`

Structured table with header and rows.

```typescript
table({
  header: ['Item', 'Qty', 'Price'],
  rows: [
    ['Espresso', '2', '$7.00'],
    ['Croissant', '1', '$3.50'],
  ],
  columnWidths: [16, 6, 10],
})
```

#### `feed(lines)`

Feed paper by N lines.

#### `cut(options?)`

Cut paper. `cut({ partial: true })` for partial cut.

#### `spacer(lines?)`

Alias for feed with a default of 1 line.

#### `raw(data)`

Insert raw ESC/POS bytes into a document.

```typescript
raw([0x1B, 0x64, 0x05])  // Feed 5 lines via raw command
```

---

### ESCPOSBuilder

Low-level fluent API for building raw ESC/POS command sequences:

```typescript
import { ESCPOSBuilder } from 'react-native-thermal-printer-driver';

const bytes = new ESCPOSBuilder()
  .init()
  .align('center')
  .bold(true)
  .size(2)
  .text('BIG TITLE\n')
  .size(1)
  .bold(false)
  .align('left')
  .text('Normal text\n')
  .qr('https://example.com', { size: 6, errorLevel: 'M' })
  .feed(4)
  .cut()
  .bytes();

await ThermalPrinter.printRaw(address, bytes);
```

**Methods:** `init()`, `text()`, `align()`, `bold()`, `underline()`, `doubleStrike()`, `reverse()`, `font()`, `size()`, `widthHeight()`, `codePage()`, `feed()`, `qr()`, `cut()`, `cashDrawer()`, `rawBytes()`, `bytes()`

---

### Error Handling

All methods throw `ThermalPrinterError` on failure with structured error info:

```typescript
import ThermalPrinter, { ThermalPrinterError, ErrorCode } from 'react-native-thermal-printer-driver';

try {
  await ThermalPrinter.connect(address);
} catch (error) {
  if (error instanceof ThermalPrinterError) {
    console.log(error.code);        // ErrorCode.CONNECTION_TIMEOUT
    console.log(error.message);     // "Connection timed out"
    console.log(error.retryable);   // true
    console.log(error.suggestion);  // "Move closer to the printer"
  }
}
```

**Error codes:**

| Code | Description | Retryable |
|------|-------------|:---------:|
| `BLUETOOTH_DISABLED` | Bluetooth is turned off | Yes |
| `BLUETOOTH_NOT_SUPPORTED` | Device has no Bluetooth | No |
| `BLUETOOTH_PERMISSION_DENIED` | Missing permissions | Yes |
| `SCAN_FAILED` | Scan encountered an error | Yes |
| `SCAN_TIMEOUT` | Scan took too long | Yes |
| `DEVICE_NOT_FOUND` | Printer not found | Yes |
| `CONNECTION_FAILED` | Could not connect | Yes |
| `CONNECTION_LOST` | Connection dropped | Yes |
| `CONNECTION_TIMEOUT` | Connection timed out | Yes |
| `WRITE_FAILED` | Failed to send data | Yes |
| `PRINT_TIMEOUT` | Print operation timed out | Yes |
| `INVALID_DATA` | Bad print data | No |
| `IMAGE_LOAD_FAILED` | Could not load image | No |
| `IMAGE_DECODE_FAILED` | Could not decode image | No |
| `INVALID_ADDRESS` | Bad printer address | No |
| `UNSUPPORTED_TRANSPORT` | Transport not available | No |

---

## Permissions

### Android

The Expo plugin automatically adds these permissions:

- `BLUETOOTH` / `BLUETOOTH_ADMIN` (legacy)
- `BLUETOOTH_SCAN` / `BLUETOOTH_CONNECT` (Android 12+)
- `ACCESS_FINE_LOCATION` (required for BLE scanning)
- `INTERNET` (for TCP and image downloads)

Runtime permissions are requested automatically on Android 12+.

### iOS

The Expo plugin adds Bluetooth usage descriptions to `Info.plist`:

- `NSBluetoothAlwaysUsageDescription`
- `NSBluetoothPeripheralUsageDescription`

Customize the description:

```json
{
  "expo": {
    "plugins": [
      ["react-native-thermal-printer-driver", {
        "bluetoothAlwaysPermission": "We use Bluetooth to connect to your receipt printer."
      }]
    ]
  }
}
```

---

## Paper Width Reference

| Paper | Print Width | Dots | Font A Chars | Font B Chars |
|-------|-------------|------|:------------:|:------------:|
| 58mm  | 48mm        | 384  | 32           | 42           |
| 80mm  | 72mm        | 576  | 48           | 64           |

---

## Tested Printers

| Printer | Transport | Paper | Status |
|---------|-----------|-------|--------|
| MPT-II (Milestone) | Bluetooth Classic | 58mm | Verified |

> If you've tested with another printer, open a PR to add it to this list!

---

## Troubleshooting

### "Native module not found"
This library requires a custom development build. It will not work with Expo Go. Run:
```bash
npx expo prebuild --clean
npx expo run:android  # or run:ios
```

### BLE printer not appearing in scan
- Ensure Bluetooth is enabled
- On Android 12+, location permissions are required for BLE scanning
- Some printers require pairing via system Bluetooth settings first

### Image prints as solid black
- Ensure the image has good contrast
- Use PNG format for best results
- The library uses Floyd-Steinberg dithering, which works best with images that have clear light/dark areas

### Bluetooth Classic not working on iOS
Bluetooth Classic (SPP/RFCOMM) is not supported on iOS. Use a BLE-capable printer or connect via TCP/Wi-Fi.

### Print is garbled or cut off
- Check `paperWidthMm` matches your paper (58 or 80)
- Increase `timeout` for large images
- Ensure the printer supports the ESC/POS commands being sent

---

## Architecture

```
react-native-thermal-printer-driver
├── src/                    # TypeScript API
│   ├── index.ts            # Public API (scan, connect, print, ...)
│   ├── NativeThermalPrinterDriver.ts  # TurboModule spec
│   ├── document/           # Node types, builders, compiler
│   ├── escpos/             # ESCPOSBuilder, command constants
│   └── errors.ts           # Error types and codes
├── android/                # Kotlin native module
│   ├── ThermalPrinterDriverModule.kt
│   ├── transport/          # BLE, Classic BT, TCP transports
│   ├── discovery/          # Device scanner
│   └── image/              # Image processor (dithering)
├── ios/                    # Swift native module
│   ├── ThermalPrinterDriverModule.swift
│   ├── transport/          # BLE, TCP transports
│   ├── discovery/          # BLE scanner
│   └── image/              # Image processor (dithering)
└── app.plugin.js           # Expo config plugin
```

---

## License

MIT

---

## Contributing

Contributions are welcome! Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your feature branch (`git checkout -b feat/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request
