// Self-contained config plugin for react-native-thermal-printer-driver
// Uses module.createRequire to resolve @expo/config-plugins from the consuming app
const { createRequire } = require('module');

// __filename is in the library source (symlinked). We need to resolve
// @expo/config-plugins from the consuming app. Walk up to find node_modules.
function findAppRequire() {
  // Try the standard require first
  try { return require; } catch {}
  // If symlinked, construct a require from the consuming app
  const path = require('path');
  let dir = __dirname;
  for (let i = 0; i < 10; i++) {
    try {
      const r = createRequire(path.join(dir, 'node_modules', '.package-lock.json'));
      r.resolve('@expo/config-plugins');
      return r;
    } catch {}
    dir = path.dirname(dir);
  }
  return require;
}

const appRequire = findAppRequire();

let configPlugins;
try {
  configPlugins = appRequire('@expo/config-plugins');
} catch {
  // Last resort: try to find it anywhere in the module search path
  configPlugins = require(require.resolve('@expo/config-plugins', {
    paths: [process.cwd(), __dirname]
  }));
}

const { createRunOncePlugin, withAndroidManifest, withInfoPlist } = configPlugins;
const pkg = require('./package.json');

const BLUETOOTH_PERMISSIONS = [
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
  'android.permission.BLUETOOTH_SCAN',
  'android.permission.BLUETOOTH_CONNECT',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.INTERNET',
];

function withAndroidBluetooth(config) {
  return withAndroidManifest(config, (androidConfig) => {
    const manifest = androidConfig.modResults.manifest;
    if (!manifest['uses-permission']) {
      manifest['uses-permission'] = [];
    }
    for (const perm of BLUETOOTH_PERMISSIONS) {
      const exists = manifest['uses-permission'].some(
        (p) => p.$['android:name'] === perm
      );
      if (!exists) {
        manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }
    return androidConfig;
  });
}

function withIosBluetooth(config, options) {
  return withInfoPlist(config, (iosConfig) => {
    iosConfig.modResults['NSBluetoothAlwaysUsageDescription'] =
      iosConfig.modResults['NSBluetoothAlwaysUsageDescription'] ??
      (options?.bluetoothAlwaysUsageDescription ??
        'This app uses Bluetooth to communicate with thermal printers.');
    iosConfig.modResults['NSBluetoothPeripheralUsageDescription'] =
      iosConfig.modResults['NSBluetoothPeripheralUsageDescription'] ??
      (options?.bluetoothPeripheralUsageDescription ??
        'This app uses Bluetooth to communicate with thermal printers.');
    return iosConfig;
  });
}

function withThermalPrinterDriver(config, options) {
  config = withAndroidBluetooth(config);
  config = withIosBluetooth(config, options);
  return config;
}

module.exports = createRunOncePlugin(
  withThermalPrinterDriver,
  pkg.name,
  pkg.version
);
