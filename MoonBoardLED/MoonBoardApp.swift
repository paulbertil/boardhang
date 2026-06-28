import SwiftUI
import SwiftData

@main
struct MoonBoardApp: App {
    @StateObject private var ble = MoonBoardBLEManager()

    var body: some Scene {
        WindowGroup {
            ProblemListView()
                .environmentObject(ble)
        }
        .modelContainer(for: Problem.self)
    }
}
