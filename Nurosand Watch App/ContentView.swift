//
//  ContentView.swift
//  Nurosand Watch App
//
//  Created by Matthew Corcoran on 25/07/2026.
//

import SwiftUI

struct ContentView: View {
    @State private var heartRate = HeartRateManager()
    @State private var motion = MotionManager()
    @State private var streamer = HeartRateStreamer()
    @State private var isRunning = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Text(bpmText)
                    .font(.system(size: 44, weight: .semibold, design: .rounded))
                    .monospacedDigit()
                    .frame(maxWidth: .infinity)

                Text("BPM")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)

                LabeledContent("IMU") {
                    Text(imuText)
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }

                LabeledContent("HR") {
                    Text(heartRate.statusMessage)
                        .foregroundStyle(.secondary)
                }

                LabeledContent("Motion") {
                    Text(motion.statusMessage)
                        .foregroundStyle(.secondary)
                }

                LabeledContent("Net") {
                    Text(streamer.statusMessage)
                        .foregroundStyle(streamer.isConnected ? .green : .secondary)
                        .lineLimit(2)
                }

                TextField("Mac IP", text: $streamer.host)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .disabled(isRunning)

                HStack {
                    Button(isRunning ? "Stop" : "Start") {
                        Task { await toggle() }
                    }
                    .tint(isRunning ? .red : .green)

                    Text(":\(streamer.port)")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .padding(.horizontal, 4)
        }
        .onAppear {
            heartRate.onHeartRate = { bpm, timestamp in
                streamer.send(bpm: bpm, timestamp: timestamp)
            }
            motion.onSample = { accel, gyro, attitude, timestamp in
                streamer.sendIMU(accel: accel, gyro: gyro, attitude: attitude, timestamp: timestamp)
            }
        }
    }

    private var bpmText: String {
        guard let bpm = heartRate.bpm else { return "—" }
        return String(format: "%.0f", bpm)
    }

    private var imuText: String {
        guard let a = motion.accelMagnitude else { return "—" }
        return String(format: "a=%.2f", a)
    }

    private func toggle() async {
        if isRunning {
            motion.stop()
            streamer.stop()
            await heartRate.stop()
            isRunning = false
        } else {
            do {
                streamer.start()
                try await heartRate.start()
                motion.start()
                isRunning = true
            } catch {
                motion.stop()
                streamer.stop()
                isRunning = false
            }
        }
    }
}

#Preview {
    ContentView()
}
