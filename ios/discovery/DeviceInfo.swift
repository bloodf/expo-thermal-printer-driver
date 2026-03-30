// DeviceInfo.swift — Discovered printer descriptor
import Foundation

struct DeviceInfo {
    let name: String
    let address: String   // BLE: UUID string; LAN: "host:port"
    let deviceType: String  // "ble" | "lan" | "unknown"
    let rssi: Int?

    func toDictionary() -> [String: Any] {
        var dict: [String: Any] = [
            "name": name,
            "address": address,
            "deviceType": deviceType,
        ]
        if let rssi = rssi {
            dict["rssi"] = rssi
        }
        return dict
    }
}
