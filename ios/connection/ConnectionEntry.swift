// ConnectionEntry.swift — Pool entry wrapping a live transport
import Foundation

struct ConnectionEntry {
    let transport: any Transport
    var lastUsed: Date

    init(transport: any Transport) {
        self.transport = transport
        self.lastUsed = Date()
    }

    mutating func touch() {
        lastUsed = Date()
    }
}
