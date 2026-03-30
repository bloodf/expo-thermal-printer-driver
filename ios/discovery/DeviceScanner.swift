// DeviceScanner.swift — BLE device discovery via CBCentralManager
// Note: iOS does not expose paired Bluetooth Classic devices; `paired` array is always empty.
import Foundation
import CoreBluetooth

final class DeviceScanner: NSObject {

    // MARK: - Properties

    private var centralManager: CBCentralManager?
    private var discovered: [DeviceInfo] = []
    private var scanTimer: Timer?
    private var completion: (([DeviceInfo]) -> Void)?

    private let scanTimeout: TimeInterval = 10.0

    // MARK: - Public API

    func scan(completion: @escaping ([DeviceInfo]) -> Void) {
        self.completion = completion
        self.discovered = []

        let manager = CBCentralManager(delegate: self, queue: .main)
        self.centralManager = manager

        scanTimer = Timer.scheduledTimer(withTimeInterval: scanTimeout, repeats: false) { [weak self] _ in
            self?.finishScan()
        }
    }

    func stopScan() {
        finishScan()
    }

    // MARK: - Private

    private func finishScan() {
        scanTimer?.invalidate()
        scanTimer = nil
        centralManager?.stopScan()
        let result = discovered
        let cb = completion
        completion = nil
        cb?(result)
    }
}

// MARK: - CBCentralManagerDelegate

extension DeviceScanner: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            central.scanForPeripherals(withServices: nil, options: [
                CBCentralManagerScanOptionAllowDuplicatesKey: false
            ])
        } else {
            finishScan()
        }
    }

    func centralManager(_ central: CBCentralManager,
                        didDiscover peripheral: CBPeripheral,
                        advertisementData: [String: Any],
                        rssi RSSI: NSNumber) {
        let address = peripheral.identifier.uuidString
        guard !discovered.contains(where: { $0.address == address }) else { return }

        let name = peripheral.name
            ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
            ?? "Unknown"

        discovered.append(DeviceInfo(
            name: name,
            address: address,
            deviceType: "ble",
            rssi: RSSI.intValue
        ))
    }
}
