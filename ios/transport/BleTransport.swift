// BleTransport.swift — CoreBluetooth transport for BLE ESC/POS printers
import Foundation
import CoreBluetooth

final class BleTransport: NSObject, Transport {

    // MARK: - Properties

    private let peripheralId: String
    private let connectionTimeout: TimeInterval

    private var centralManager: CBCentralManager?
    private var peripheral: CBPeripheral?
    private var writeCharacteristic: CBCharacteristic?

    private var connectContinuation: CheckedContinuation<Void, Error>?
    private var writeContinuation: CheckedContinuation<Void, Error>?

    private(set) var isConnected: Bool = false
    private var mtu: Int = 20

    // MARK: - Init

    init(peripheralId: String, timeout: TimeInterval = 10.0) {
        self.peripheralId = peripheralId
        self.connectionTimeout = timeout
        super.init()
    }

    // MARK: - Transport

    func connect() async throws {
        guard !isConnected else { return }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            self.connectContinuation = continuation

            let manager = CBCentralManager(delegate: self, queue: .main)
            self.centralManager = manager

            DispatchQueue.main.asyncAfter(deadline: .now() + connectionTimeout) { [weak self] in
                guard let self, let cont = self.connectContinuation else { return }
                self.connectContinuation = nil
                self.centralManager?.stopScan()
                cont.resume(throwing: TransportError.connectionTimeout)
            }
        }
    }

    func write(_ data: Data) async throws {
        guard isConnected,
              let peripheral,
              let characteristic = writeCharacteristic else {
            throw TransportError.notConnected
        }

        let writeType: CBCharacteristicWriteType = characteristic.properties.contains(.writeWithoutResponse)
            ? .withoutResponse
            : .withResponse

        var offset = 0
        while offset < data.count {
            let end = min(offset + mtu, data.count)
            let chunk = Data(data[offset..<end])

            if writeType == .withoutResponse {
                peripheral.writeValue(chunk, for: characteristic, type: .withoutResponse)
            } else {
                try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                    self.writeContinuation = continuation
                    peripheral.writeValue(chunk, for: characteristic, type: .withResponse)
                }
            }

            offset = end
        }
    }

    func close() {
        if let p = peripheral {
            centralManager?.cancelPeripheralConnection(p)
        }
        isConnected = false
        peripheral = nil
        writeCharacteristic = nil
        let cc = connectContinuation
        let wc = writeContinuation
        connectContinuation = nil
        writeContinuation = nil
        cc?.resume(throwing: TransportError.notConnected)
        wc?.resume(throwing: TransportError.notConnected)
    }

    // MARK: - Helpers

    private func negotiateMTU() {
        guard let p = peripheral else { return }
        let negotiated = p.maximumWriteValueLength(for: .withoutResponse)
        mtu = max(20, min(negotiated, 512))
    }

    private func findAndConnectPeripheral() {
        guard let manager = centralManager else { return }

        if let uuid = UUID(uuidString: peripheralId) {
            let known = manager.retrievePeripherals(withIdentifiers: [uuid])
            if let p = known.first {
                peripheral = p
                p.delegate = self
                manager.connect(p, options: nil)
                return
            }
        }

        // Peripheral not in cache — fail fast on iOS (no MAC scanning)
        let cont = connectContinuation
        connectContinuation = nil
        cont?.resume(throwing: TransportError.peripheralNotFound)
    }
}

// MARK: - CBCentralManagerDelegate

extension BleTransport: CBCentralManagerDelegate {
    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        switch central.state {
        case .poweredOn:
            findAndConnectPeripheral()
        default:
            let cont = connectContinuation
            connectContinuation = nil
            cont?.resume(throwing: TransportError.peripheralNotFound)
        }
    }

    func centralManager(_ central: CBCentralManager,
                        didConnect peripheral: CBPeripheral) {
        self.peripheral = peripheral
        peripheral.delegate = self
        negotiateMTU()
        peripheral.discoverServices(nil)
    }

    func centralManager(_ central: CBCentralManager,
                        didFailToConnect peripheral: CBPeripheral,
                        error: Error?) {
        isConnected = false
        let cont = connectContinuation
        connectContinuation = nil
        cont?.resume(throwing: error ?? TransportError.peripheralNotFound)
    }

    func centralManager(_ central: CBCentralManager,
                        didDisconnectPeripheral peripheral: CBPeripheral,
                        error: Error?) {
        isConnected = false
        let wc = writeContinuation
        writeContinuation = nil
        wc?.resume(throwing: TransportError.notConnected)
    }
}

// MARK: - CBPeripheralDelegate

extension BleTransport: CBPeripheralDelegate {
    func peripheral(_ peripheral: CBPeripheral,
                    didDiscoverServices error: Error?) {
        guard error == nil, let services = peripheral.services, !services.isEmpty else {
            let cont = connectContinuation
            connectContinuation = nil
            cont?.resume(throwing: error ?? TransportError.noWritableCharacteristic)
            return
        }
        for service in services {
            peripheral.discoverCharacteristics(nil, for: service)
        }
    }

    func peripheral(_ peripheral: CBPeripheral,
                    didDiscoverCharacteristicsFor service: CBService,
                    error: Error?) {
        guard error == nil, let characteristics = service.characteristics else { return }

        for char in characteristics {
            if char.properties.contains(.write) || char.properties.contains(.writeWithoutResponse) {
                writeCharacteristic = char
                isConnected = true
                let cont = connectContinuation
                connectContinuation = nil
                cont?.resume()
                return
            }
        }

        // If this was the last service and we found nothing, fail
        if let services = peripheral.services, service.uuid == services.last?.uuid, writeCharacteristic == nil {
            let cont = connectContinuation
            connectContinuation = nil
            cont?.resume(throwing: TransportError.noWritableCharacteristic)
        }
    }

    func peripheral(_ peripheral: CBPeripheral,
                    didWriteValueFor characteristic: CBCharacteristic,
                    error: Error?) {
        let cont = writeContinuation
        writeContinuation = nil
        if let error {
            cont?.resume(throwing: TransportError.writeError(error.localizedDescription))
        } else {
            cont?.resume()
        }
    }
}
