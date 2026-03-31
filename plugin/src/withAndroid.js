const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Adds Bluetooth and location permissions required for thermal printer discovery
 * to the Android manifest.
 */
function withAndroidBluetooth(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;

    if (!manifest.manifest['uses-permission']) {
      manifest.manifest['uses-permission'] = [];
    }

    const permissions = [
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.ACCESS_FINE_LOCATION',
    ];

    const existing = new Set(
      manifest.manifest['uses-permission'].map((p) => p.$['android:name'])
    );

    for (const permission of permissions) {
      if (!existing.has(permission)) {
        manifest.manifest['uses-permission'].push({
          $: { 'android:name': permission },
        });
      }
    }

    return mod;
  });
}

module.exports = { withAndroidBluetooth };
