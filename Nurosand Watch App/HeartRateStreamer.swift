//
//  HeartRateStreamer.swift
//  Nurosand Watch App
//

import Foundation
import simd

@Observable
@MainActor
final class HeartRateStreamer {
    var host: String = {
        #if targetEnvironment(simulator)
        "127.0.0.1"
        #else
        ""
        #endif
    }()
    var port: UInt16 = 8765

    private(set) var statusMessage = "Disconnected"
    private(set) var isConnected = false

    private var shouldRun = false
    private var pingTask: Task<Void, Never>?
    private let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 5
        config.timeoutIntervalForResource = 5
        config.waitsForConnectivity = false
        return URLSession(configuration: config)
    }()

    func start() {
        shouldRun = true
        isConnected = false
        statusMessage = "Connecting…"
        pingTask?.cancel()
        pingTask = Task { await runPingLoop() }
    }

    func stop() {
        shouldRun = false
        pingTask?.cancel()
        pingTask = nil
        isConnected = false
        statusMessage = "Disconnected"
    }

    func send(bpm: Double, timestamp: TimeInterval = Date().timeIntervalSince1970) {
        post(path: "/bpm", payload: [
            "type": "hr",
            "bpm": bpm,
            "t": timestamp,
        ])
    }

    func sendIMU(
        accel: SIMD3<Double>,
        gyro: SIMD3<Double>,
        attitude: SIMD3<Double>,
        timestamp: TimeInterval
    ) {
        post(path: "/imu", payload: [
            "type": "imu",
            "t": timestamp,
            "ax": accel.x, "ay": accel.y, "az": accel.z,
            "gx": gyro.x, "gy": gyro.y, "gz": gyro.z,
            "roll": attitude.x, "pitch": attitude.y, "yaw": attitude.z,
            "amag": simd_length(accel),
            "gmag": simd_length(gyro),
        ])
    }

    private func post(path: String, payload: [String: Any]) {
        guard shouldRun else { return }
        guard let url = endpointURL(path: path) else {
            statusMessage = "Enter Mac IP"
            return
        }
        guard let body = try? JSONSerialization.data(withJSONObject: payload) else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body

        Task {
            do {
                let (_, response) = try await session.data(for: request)
                let code = (response as? HTTPURLResponse)?.statusCode ?? -1
                if (200...299).contains(code) {
                    isConnected = true
                    statusMessage = "Connected"
                } else {
                    isConnected = false
                    statusMessage = "HTTP \(code)"
                }
            } catch {
                isConnected = false
                statusMessage = "Send: \(error.localizedDescription)"
            }
        }
    }

    private func endpointURL(path: String) -> URL? {
        let trimmedHost = host.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedHost.isEmpty else { return nil }
        return URL(string: "http://\(trimmedHost):\(port)\(path)")
    }

    private func runPingLoop() async {
        while shouldRun, !Task.isCancelled {
            await ping()
            try? await Task.sleep(for: .seconds(isConnected ? 10 : 2))
        }
    }

    private func ping() async {
        guard let url = endpointURL(path: "/") else {
            statusMessage = "Enter Mac IP"
            isConnected = false
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"

        do {
            let (_, response) = try await session.data(for: request)
            let code = (response as? HTTPURLResponse)?.statusCode ?? -1
            if (200...399).contains(code) {
                isConnected = true
                if statusMessage.hasPrefix("Send:") || statusMessage == "Connecting…" || statusMessage.hasPrefix("Ping:") {
                    statusMessage = "Connected"
                }
            } else {
                isConnected = false
                statusMessage = "HTTP \(code)"
            }
        } catch {
            isConnected = false
            statusMessage = "Ping: \(error.localizedDescription)"
        }
    }
}
