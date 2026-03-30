// Transport.swift — Abstract transport protocol for printer communication
import Foundation

enum TransportError: Error, LocalizedError {
    case notConnected
    case connectionTimeout
    case peripheralNotFound
    case noWritableCharacteristic
    case writeError(String)

    var errorDescription: String? {
        switch self {
        case .notConnected: return "Transport is not connected"
        case .connectionTimeout: return "Connection timed out"
        case .peripheralNotFound: return "BLE peripheral not found"
        case .noWritableCharacteristic: return "No writable BLE characteristic found"
        case .writeError(let msg): return "Write failed: \(msg)"
        }
    }
}

protocol Transport: AnyObject {
    var isConnected: Bool { get }
    func connect() async throws
    func write(_ data: Data) async throws
    func close()
}
