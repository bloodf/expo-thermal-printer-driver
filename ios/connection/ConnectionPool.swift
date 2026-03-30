// ConnectionPool.swift — Thread-safe transport pool with idle-connection cleanup
import Foundation

final class ConnectionPool {

    // MARK: - Configuration

    private let idleThreshold: TimeInterval = 30.0
    private let checkInterval: TimeInterval = 10.0

    // MARK: - State

    private var pool: [String: ConnectionEntry] = [:]
    private let lock = NSLock()
    private var cleanupTimer: Timer?

    // MARK: - Init / deinit

    init() {
        DispatchQueue.main.async { [weak self] in
            self?.startCleanupTimer()
        }
    }

    deinit {
        cleanupTimer?.invalidate()
        closeAll()
    }

    // MARK: - Public API

    /// Returns the existing live transport for `address`, updating lastUsed. Returns nil if absent or disconnected.
    func get(for address: String) -> (any Transport)? {
        lock.lock()
        defer { lock.unlock() }
        guard var entry = pool[address] else { return nil }
        guard entry.transport.isConnected else {
            pool.removeValue(forKey: address)
            return nil
        }
        entry.touch()
        pool[address] = entry
        return entry.transport
    }

    /// Stores a transport in the pool under `address`.
    func put(_ transport: any Transport, for address: String) {
        lock.lock()
        defer { lock.unlock() }
        pool[address] = ConnectionEntry(transport: transport)
    }

    /// Closes and removes the transport for `address`.
    func remove(for address: String) {
        lock.lock()
        let entry = pool.removeValue(forKey: address)
        lock.unlock()
        entry?.transport.close()
    }

    /// Closes all pooled transports and empties the pool.
    func closeAll() {
        lock.lock()
        let snapshot = pool
        pool = [:]
        lock.unlock()
        snapshot.values.forEach { $0.transport.close() }
    }

    // MARK: - Idle cleanup

    private func startCleanupTimer() {
        cleanupTimer = Timer.scheduledTimer(withTimeInterval: checkInterval, repeats: true) { [weak self] _ in
            self?.evictIdle()
        }
    }

    private func evictIdle() {
        let now = Date()
        lock.lock()
        let stale = pool.filter { now.timeIntervalSince($0.value.lastUsed) > idleThreshold }
        stale.keys.forEach { pool.removeValue(forKey: $0) }
        lock.unlock()
        stale.values.forEach { $0.transport.close() }
    }
}
