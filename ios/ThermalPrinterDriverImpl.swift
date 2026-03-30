// ThermalPrinterDriverImpl.swift — Swift implementation of all TurboModule methods
import Foundation

/// Bridged block types matching RCTPromiseResolveBlock / RCTPromiseRejectBlock
public typealias PromiseResolve = (Any?) -> Void
public typealias PromiseReject  = (String, String, Error?) -> Void

@objc(ThermalPrinterDriverImpl)
public final class ThermalPrinterDriverImpl: NSObject {

    // MARK: - Dependencies

    private let pool           = ConnectionPool()
    private let imageProcessor = ImageProcessor()
    private var activeScanner: DeviceScanner?

    /// Called by the ObjC bridge to forward events to JS via RCTEventEmitter.
    @objc public var onEvent: ((String, [String: Any]) -> Void)?

    // MARK: - Address parsing

    private enum ParsedAddress {
        case ble(uuid: String)
        case lan(host: String, port: UInt16)
        case bt                            // unsupported on iOS
    }

    private func parseAddress(_ address: String) -> ParsedAddress {
        if address.hasPrefix("ble:") {
            return .ble(uuid: String(address.dropFirst(4)))
        }
        if address.hasPrefix("lan:") {
            return parseLan(String(address.dropFirst(4)))
        }
        if address.hasPrefix("bt:") {
            return .bt
        }
        // Heuristic: 6 hex groups separated by colons → Bluetooth Classic MAC
        let parts = address.split(separator: ":")
        if parts.count == 6 && parts.allSatisfy({ $0.count == 2 }) {
            return .bt
        }
        // Fallback: treat as host[:port]
        return parseLan(address)
    }

    private func parseLan(_ raw: String) -> ParsedAddress {
        // Handle IPv6 [::1]:9100 form as well as plain host:port
        if raw.hasPrefix("[") {
            let closing = raw.firstIndex(of: "]") ?? raw.endIndex
            let host = String(raw[raw.index(after: raw.startIndex)..<closing])
            let remainder = raw[closing...]
            let port = remainder.hasPrefix("]:") ? UInt16(remainder.dropFirst(2)) ?? 9100 : 9100
            return .lan(host: host, port: port)
        }
        let segments = raw.split(separator: ":", maxSplits: 1)
        let host = segments.count > 0 ? String(segments[0]) : raw
        let port = segments.count > 1 ? UInt16(segments[1]) ?? 9100 : 9100
        return .lan(host: host, port: port)
    }

    // MARK: - Transport factory

    private func makeTransport(_ parsed: ParsedAddress, timeout: TimeInterval) throws -> any Transport {
        switch parsed {
        case .ble(let uuid):
            return BleTransport(peripheralId: uuid, timeout: timeout)
        case .lan(let host, let port):
            return TcpTransport(host: host, port: port, timeout: timeout)
        case .bt:
            throw TransportError.notConnected   // should never reach; handled before call
        }
    }

    private func acquireTransport(address: String,
                                   parsed: ParsedAddress,
                                   timeout: TimeInterval) async throws -> any Transport {
        if let existing = pool.get(for: address) {
            return existing
        }
        let transport = try makeTransport(parsed, timeout: timeout)
        try await transport.connect()
        pool.put(transport, for: address)
        return transport
    }

    // MARK: - Error helpers

    private func unsupportedBtResult() -> [String: Any] {
        return [
            "success": false,
            "error": [
                "code": "UNSUPPORTED_TRANSPORT",
                "message": "Bluetooth Classic is not available on iOS.",
                "retryable": false,
                "suggestion": "Use ble: or lan: on iOS. Bluetooth Classic is not available on iOS."
            ]
        ]
    }

    private func errorResult(_ code: String, _ message: String, retryable: Bool = true) -> [String: Any] {
        return [
            "success": false,
            "error": [
                "code": code,
                "message": message,
                "retryable": retryable
            ]
        ]
    }

    // MARK: - scanDevices

    @objc(scanDevicesWithResolve:reject:)
    public func scanDevices(resolve: @escaping PromiseResolve,
                            reject: @escaping PromiseReject) {
        let scanner = DeviceScanner()
        activeScanner = scanner

        scanner.scan { [weak self] devices in
            self?.activeScanner = nil
            resolve([
                "paired": [],
                "found": devices.map { $0.toDictionary() }
            ])
        }
    }

    // MARK: - stopScan

    @objc(stopScanWithResolve:reject:)
    public func stopScan(resolve: @escaping PromiseResolve,
                         reject: @escaping PromiseReject) {
        activeScanner?.stopScan()
        activeScanner = nil
        resolve(true)
    }

    // MARK: - connect

    @objc(connectWithAddress:timeout:resolve:reject:)
    public func connect(address: String,
                        timeout: Double,
                        resolve: @escaping PromiseResolve,
                        reject: @escaping PromiseReject) {
        let parsed = parseAddress(address)
        if case .bt = parsed {
            resolve(unsupportedBtResult()); return
        }

        if pool.get(for: address) != nil {
            resolve(["success": true, "alreadyConnected": true]); return
        }

        Task {
            do {
                let transport = try makeTransport(parsed, timeout: timeout)
                try await transport.connect()
                pool.put(transport, for: address)
                resolve(["success": true])
            } catch {
                resolve(errorResult("CONNECTION_FAILED", error.localizedDescription))
            }
        }
    }

    // MARK: - disconnect

    @objc(disconnectWithAddress:resolve:reject:)
    public func disconnect(address: String?,
                           resolve: @escaping PromiseResolve,
                           reject: @escaping PromiseReject) {
        if let address, !address.isEmpty {
            pool.remove(for: address)
        } else {
            pool.closeAll()
        }
        resolve(nil)
    }

    // MARK: - testConnection

    @objc(testConnectionWithAddress:resolve:reject:)
    public func testConnection(address: String,
                               resolve: @escaping PromiseResolve,
                               reject: @escaping PromiseReject) {
        let parsed = parseAddress(address)
        if case .bt = parsed {
            resolve(unsupportedBtResult()); return
        }

        Task {
            do {
                let transport = try makeTransport(parsed, timeout: 5.0)
                try await transport.connect()
                try await transport.write(Data([0x1B, 0x40]))  // ESC @ — initialize
                transport.close()
                resolve(["success": true])
            } catch {
                resolve(errorResult("TEST_FAILED", error.localizedDescription))
            }
        }
    }

    // MARK: - printRaw

    @objc(printRawWithAddress:data:keepAlive:timeout:resolve:reject:)
    public func printRaw(address: String,
                         data: [NSNumber],
                         keepAlive: Bool,
                         timeout: Double,
                         resolve: @escaping PromiseResolve,
                         reject: @escaping PromiseReject) {
        let parsed = parseAddress(address)
        if case .bt = parsed {
            resolve(unsupportedBtResult()); return
        }

        let bytes = Data(data.map { UInt8($0.intValue & 0xFF) })

        Task {
            do {
                let transport = try await acquireTransport(address: address,
                                                           parsed: parsed,
                                                           timeout: timeout)
                try await transport.write(bytes)
                if !keepAlive {
                    pool.remove(for: address)
                }
                resolve(["success": true, "bytesWritten": bytes.count])
            } catch {
                resolve(errorResult("PRINT_FAILED", error.localizedDescription))
            }
        }
    }

    // MARK: - printImage

    @objc(printImageWithAddress:source:sourceType:widthPx:align:keepAlive:timeout:resolve:reject:)
    public func printImage(address: String,
                           source: String,
                           sourceType: String,
                           widthPx: Int,
                           align: Int,
                           keepAlive: Bool,
                           timeout: Double,
                           resolve: @escaping PromiseResolve,
                           reject: @escaping PromiseReject) {
        let parsed = parseAddress(address)
        if case .bt = parsed {
            resolve(unsupportedBtResult()); return
        }

        Task {
            do {
                let imageData = try imageProcessor.process(
                    source: source,
                    sourceType: sourceType,
                    widthPx: widthPx,
                    align: align
                )
                let transport = try await acquireTransport(address: address,
                                                           parsed: parsed,
                                                           timeout: timeout)
                try await transport.write(imageData)
                if !keepAlive {
                    pool.remove(for: address)
                }
                resolve(["success": true, "bytesWritten": imageData.count])
            } catch {
                resolve(errorResult("PRINT_IMAGE_FAILED", error.localizedDescription))
            }
        }
    }

    // MARK: - RCTEventEmitter boilerplate (forwarded from bridge)

    @objc public func addListener(_ eventName: String) {}
    @objc public func removeListeners(_ count: Double) {}
}
