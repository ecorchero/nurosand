//
//  HeartRateManager.swift
//  Nurosand Watch App
//

import Foundation
import HealthKit

@Observable
@MainActor
final class HeartRateManager: NSObject {
    private(set) var bpm: Double?
    private(set) var isActive = false
    private(set) var statusMessage = "Idle"
    var onHeartRate: ((Double, TimeInterval) -> Void)?

    private let healthStore = HKHealthStore()
    private var session: HKWorkoutSession?
    private var builder: HKLiveWorkoutBuilder?
    private var mockTimer: Timer?

    private let heartRateType = HKQuantityType.quantityType(forIdentifier: .heartRate)!

    private var isSimulator: Bool {
        #if targetEnvironment(simulator)
        true
        #else
        false
        #endif
    }

    func requestAuthorization() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            statusMessage = "Health data unavailable"
            throw HeartRateError.unavailable
        }

        try await healthStore.requestAuthorization(
            toShare: [HKObjectType.workoutType()],
            read: [heartRateType]
        )
        statusMessage = "Authorized"
    }

    func start() async throws {
        guard !isActive else { return }

        // Simulator has no optical HR sensor — emit fake BPM so the network path can be tested.
        if isSimulator {
            isActive = true
            statusMessage = "Mock HR (sim)"
            startMockHeartRate()
            return
        }

        do {
            try await requestAuthorization()

            let configuration = HKWorkoutConfiguration()
            configuration.activityType = .other
            configuration.locationType = .indoor

            let workoutSession = try HKWorkoutSession(healthStore: healthStore, configuration: configuration)
            let workoutBuilder = workoutSession.associatedWorkoutBuilder()
            workoutBuilder.dataSource = HKLiveWorkoutDataSource(
                healthStore: healthStore,
                workoutConfiguration: configuration
            )

            workoutSession.delegate = self
            workoutBuilder.delegate = self

            session = workoutSession
            builder = workoutBuilder

            let startDate = Date()
            workoutSession.startActivity(with: startDate)
            try await workoutBuilder.beginCollection(at: startDate)

            isActive = true
            statusMessage = "Streaming"
        } catch {
            statusMessage = error.localizedDescription
            session = nil
            builder = nil
            isActive = false
            throw error
        }
    }

    func stop() async {
        guard isActive else { return }

        stopMockHeartRate()

        let endDate = Date()
        session?.end()

        do {
            try await builder?.endCollection(at: endDate)
            _ = try await builder?.finishWorkout()
        } catch {
            statusMessage = "Stop error: \(error.localizedDescription)"
        }

        session = nil
        builder = nil
        isActive = false
        statusMessage = "Stopped"
    }

    private func handleHeartRate(_ quantity: HKQuantity, date: Date) {
        let value = quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
        publish(bpm: value, timestamp: date.timeIntervalSince1970)
    }

    private func publish(bpm value: Double, timestamp: TimeInterval) {
        bpm = value
        onHeartRate?(value, timestamp)
    }

    private func startMockHeartRate() {
        stopMockHeartRate()
        // ~60–90 BPM with a slow sine wobble
        mockTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.isActive else { return }
                let t = Date().timeIntervalSince1970
                let value = 72 + 12 * sin(t / 4)
                self.publish(bpm: value, timestamp: t)
            }
        }
        if let mockTimer {
            RunLoop.main.add(mockTimer, forMode: .common)
        }
    }

    private func stopMockHeartRate() {
        mockTimer?.invalidate()
        mockTimer = nil
    }
}

extension HeartRateManager: HKWorkoutSessionDelegate {
    nonisolated func workoutSession(
        _ workoutSession: HKWorkoutSession,
        didChangeTo toState: HKWorkoutSessionState,
        from fromState: HKWorkoutSessionState,
        date: Date
    ) {
        Task { @MainActor in
            switch toState {
            case .running:
                statusMessage = "Streaming"
            case .ended, .stopped:
                isActive = false
                statusMessage = "Stopped"
            case .paused:
                statusMessage = "Paused"
            default:
                break
            }
        }
    }

    nonisolated func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        Task { @MainActor in
            statusMessage = "Session error: \(error.localizedDescription)"
            isActive = false
        }
    }
}

extension HeartRateManager: HKLiveWorkoutBuilderDelegate {
    nonisolated func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}

    nonisolated func workoutBuilder(
        _ workoutBuilder: HKLiveWorkoutBuilder,
        didCollectDataOf collectedTypes: Set<HKSampleType>
    ) {
        guard let type = HKQuantityType.quantityType(forIdentifier: .heartRate),
              collectedTypes.contains(type) else { return }

        let statistics = workoutBuilder.statistics(for: type)
        guard let quantity = statistics?.mostRecentQuantity() else { return }
        let date = statistics?.mostRecentQuantityDateInterval()?.end ?? Date()

        Task { @MainActor in
            handleHeartRate(quantity, date: date)
        }
    }
}

enum HeartRateError: LocalizedError {
    case unavailable

    var errorDescription: String? {
        switch self {
        case .unavailable:
            return "HealthKit is not available on this device."
        }
    }
}
