import SwiftUI
import SwiftData

/// View a saved problem and light it up on the board.
struct ProblemDetailView: View {
    @EnvironmentObject private var ble: MoonBoardBLEManager
    @Environment(\.modelContext) private var context
    @Environment(\.dismiss) private var dismiss
    @AppStorage("boardOrientationFlipped") private var flipped = false
    @AppStorage("showBeta") private var showBeta = true
    @State private var showingEditor = false
    @State private var confirmingDelete = false

    let problem: Problem

    var body: some View {
        VStack(spacing: 12) {
            BoardGridView(holds: problem.holds, showBeta: showBeta)
                .padding(.horizontal, 8)

            Toggle("Show beta", isOn: $showBeta)
                .padding(.horizontal)
                .onChange(of: showBeta) { _, _ in
                    if ble.isConnected {
                        ble.send(holds: problem.holds, flipped: flipped, showBeta: showBeta)
                    }
                }

            HStack(spacing: 12) {
                Button {
                    ble.send(holds: problem.holds, flipped: flipped, showBeta: showBeta)
                } label: {
                    Label("Light up on board", systemImage: "lightbulb.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!ble.isConnected)

                Button {
                    ble.clear()
                } label: {
                    Label("Clear", systemImage: "lightbulb.slash")
                }
                .buttonStyle(.bordered)
                .disabled(!ble.isConnected)
            }
            .padding(.horizontal)

            if !ble.isConnected {
                Text("Connect to the board to light it up.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(.bottom)
        .navigationTitle(problem.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                HStack {
                    Text(problem.grade).font(.subheadline.weight(.semibold))
                    Menu {
                        Button { showingEditor = true } label: { Label("Edit", systemImage: "pencil") }
                        Button(role: .destructive) { confirmingDelete = true } label: {
                            Label("Delete Problem", systemImage: "trash")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                }
            }
        }
        .sheet(isPresented: $showingEditor) {
            ProblemEditView(existing: problem)
        }
        .confirmationDialog("Delete \"\(problem.name)\"?", isPresented: $confirmingDelete,
                            titleVisibility: .visible) {
            Button("Delete", role: .destructive, action: deleteProblem)
            Button("Cancel", role: .cancel) {}
        }
    }

    private func deleteProblem() {
        context.delete(problem)
        dismiss()
    }
}
