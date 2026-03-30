const { withInfoPlist } = require('@expo/config-plugins');

const DEFAULT_BLUETOOTH_ALWAYS_DESCRIPTION =
  'This app uses Bluetooth to discover and connect to thermal printers.';

const DEFAULT_BLUETOOTH_PERIPHERAL_DESCRIPTION =
  'This app uses Bluetooth to connect to thermal printers.';

/**
 * Adds Bluetooth usage description keys required for iOS thermal printer access
 * to the app's Info.plist.
 */
function withIosBluetooth(config, options) {
  return withInfoPlist(config, (mod) => {
    const plist = mod.modResults;

    if (!plist.NSBluetoothAlwaysUsageDescription) {
      plist.NSBluetoothAlwaysUsageDescription =
        options?.bluetoothAlwaysUsageDescription ??
        DEFAULT_BLUETOOTH_ALWAYS_DESCRIPTION;
    }

    if (!plist.NSBluetoothPeripheralUsageDescription) {
      plist.NSBluetoothPeripheralUsageDescription =
        options?.bluetoothPeripheralUsageDescription ??
        DEFAULT_BLUETOOTH_PERIPHERAL_DESCRIPTION;
    }

    return mod;
  });
}

module.exports = { withIosBluetooth };
