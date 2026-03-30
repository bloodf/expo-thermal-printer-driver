const { createRunOncePlugin } = require('@expo/config-plugins');
const { withAndroidBluetooth } = require('./withAndroid');
const { withIosBluetooth } = require('./withIos');

const pkg = require('../../package.json');

/**
 * Expo config plugin for react-native-thermal-printer-driver.
 *
 * Automatically adds required Bluetooth permissions to both Android
 * (AndroidManifest.xml) and iOS (Info.plist). Add this plugin to your
 * app.json plugins array:
 *
 *   "plugins": ["react-native-thermal-printer-driver"]
 *
 * Optionally pass custom permission descriptions for iOS:
 *
 *   "plugins": [
 *     ["react-native-thermal-printer-driver", {
 *       "bluetoothAlwaysUsageDescription": "Custom description",
 *       "bluetoothPeripheralUsageDescription": "Custom description"
 *     }]
 *   ]
 */
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
