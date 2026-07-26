//
//  MotionManager.swift
//  Nurosand Watch App
//

import Foundation
import CoreMotion
import simd

@Observable
@MainActor
final class MotionManager {
    private(set) var isActive = false
    private(set) var statusMessage = "Idle"
    private(set) var accelMagnitude: Double?
    private(set) var gyroMagnitude: Double?
    private(set) var roll: Double?
    private(set) var pitch: Double?
    private(set) var yaw: Double?

    /// Called on the main actor with accel (g), gyro (rad/s), attitude (roll/pitch/yaw in rad), and timestamp.
    var onSample: ((SIMD3<Double>, SIMD3<Double>, SIMD3<Double>, TimeInterval) -> Void)?

    private let motion = CMMotionManager()
    private let queue = OperationQueue()
    private var mockTimer: Timer?

    /// ~10 Hz — enough for live graphs without flooding Wi‑Fi.
    private let updateInterval: TimeInterval = 0.1

    private var isSimulator: Bool {
        #if targetEnvironment(simulator)
        true
        #else
        false
        #endif
    }

    init() {
        queue.name = "nurosand.motion"
        queue.maxConcurrentOperationCount = 1
        queue.qualityOfService = .userInitiated
    }

    func start() {
        guard !isActive else { return }

        if isSimulator {
            isActive = true
            statusMessage = "Mock IMU (sim)"
            startMockMotion()
            return
        }

        guard motion.isDeviceMotionAvailable else {
            statusMessage = "Motion unavailable"
            return
        }

        motion.deviceMotionUpdateInterval = updateInterval
        isActive = true
        statusMessage = "Streaming"

        motion.startDeviceMotionUpdates(to: queue) { [weak self] data, error in
            guard let data else {
                if let error {
                    Task { @MainActor in
                        self?.statusMessage = error.localizedDescription
                    }
                }
                return
            }

            let user = data.userAcceleration
            let rot = data.rotationRate
            let att = data.attitude
            let accel = SIMD3(user.x, user.y, user.z)
            let gyro = SIMD3(rot.x, rot.y, rot.z)
            let attitude = SIMD3(att.roll, att.pitch, att.yaw)
            let t = Date().timeIntervalSince1970

            Task { @MainActor in
                guard let self, self.isActive else { return }
                self.publish(accel: accel, gyro: gyro, attitude: attitude, timestamp: t)
            }
        }
    }

    func stop() {
        guard isActive else { return }
        motion.stopDeviceMotionUpdates()
        stopMockMotion()
        isActive = false
        statusMessage = "Stopped"
    }

    private func publish(
        accel: SIMD3<Double>,
        gyro: SIMD3<Double>,
        attitude: SIMD3<Double>,
        timestamp: TimeInterval
    ) {
        accelMagnitude = simd_length(accel)
        gyroMagnitude = simd_length(gyro)
        roll = attitude.x
        pitch = attitude.y
        yaw = attitude.z
        onSample?(accel, gyro, attitude, timestamp)
    }

    private func startMockMotion() {
        stopMockMotion()
        mockTimer = Timer.scheduledTimer(withTimeInterval: updateInterval, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.isActive else { return }
                let t = Date().timeIntervalSince1970
                let accel = SIMD3(0.2 * sin(t * 3), 0.1 * cos(t * 2), 0.05 * sin(t))
                let gyro = SIMD3(0.4 * cos(t * 2), 0.3 * sin(t * 1.5), 0.1 * cos(t * 4))
                let attitude = SIMD3(0.6 * sin(t / 3), 0.5 * cos(t / 4), 0.8 * sin(t / 5))
                self.publish(accel: accel, gyro: gyro, attitude: attitude, timestamp: t)
            }
        }
        if let mockTimer {
            RunLoop.main.add(mockTimer, forMode: .common)
        }
    }

    private func stopMockMotion() {
        mockTimer?.invalidate()
        mockTimer = nil
    }
}
