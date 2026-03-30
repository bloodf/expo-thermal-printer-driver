// TcpTransport.swift — NWConnection TCP transport for LAN/WiFi ESC/POS printers
import Foundation
import Network

final class TcpTransport: Transport {

    // MARK: - Properties

    private let host: String
    private let port: UInt16
    private let timeout: TimeInterval

    private var connection: NWConnection?
    private(set) var isConnected: Bool = false

    // MARK: - Init

    init(host: String, port: UInt16, timeout: TimeInterval = 10.0) {
        self.host = host
        self.port = port
        self.timeout = timeout
    }

    // MARK: - Transport

    func connect() async throws {
        guard let nwPort = NWEndpoint.Port(rawValue: port) else {
            throw TransportError.connectionTimeout
        }

        let nwHost = NWEndpoint.Host(host)
        let conn = NWConnection(host: nwHost, port: nwPort, using: .tcp)
        self.connection = conn

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            var resumed = false

            let timeoutItem = DispatchWorkItem {
                guard !resumed else { return }
                resumed = true
                conn.cancel()
                continuation.resume(throwing: TransportError.connectionTimeout)
            }
            DispatchQueue.global().asyncAfter(deadline: .now() + timeout, execute: timeoutItem)

            conn.stateUpdateHandler = { [weak self] state in
                switch state {
                case .ready:
                    timeoutItem.cancel()
                    guard !resumed else { return }
                    resumed = true
                    self?.isConnected = true
                    continuation.resume()

                case .failed(let error):
                    timeoutItem.cancel()
                    guard !resumed else { return }
                    resumed = true
                    continuation.resume(throwing: error)

                case .cancelled:
                    timeoutItem.cancel()
                    guard !resumed else { return }
                    resumed = true
                    continuation.resume(throwing: TransportError.connectionTimeout)

                default:
                    break
                }
            }

            conn.start(queue: .global(qos: .userInitiated))
        }
    }

    func write(_ data: Data) async throws {
        guard isConnected, let connection else {
            throw TransportError.notConnected
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            connection.send(content: data, completion: .contentProcessed { error in
                if let error {
                    continuation.resume(throwing: TransportError.writeError(error.localizedDescription))
                } else {
                    continuation.resume()
                }
            })
        }
    }

    func close() {
        connection?.cancel()
        connection = nil
        isConnected = false
    }
}
