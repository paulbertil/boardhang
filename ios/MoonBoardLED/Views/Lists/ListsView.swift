import SwiftUI

/// The Lists tab: your saved lists, plus a way to create one. Cloud-backed (reuses the
/// same account as the logbook) — loads on appear + pull-to-refresh. When signed out or
/// the build is unconfigured, shows a sign-in prompt instead.
///
/// Phase 1 (Saved Lists) is personal only: create / rename / delete and open a list. The
/// collaborative surface (members, sharing, group status) is a later layer.
struct ListsView: View {
    @EnvironmentObject private var auth: AuthManager
    @EnvironmentObject private var lists: ListsManager

    @State private var showingCreate = false
    @State private var renaming: ListRow?
    @State private var renameText = ""
    @State private var loadError: String?

    private var available: Bool { lists.isConfigured && auth.status != .signedOut }

    var body: some View {
        NavigationStack {
            Group {
                if available {
                    index
                } else {
                    ContentUnavailableView {
                        Label("Sign in to use lists", systemImage: "bookmark")
                    } description: {
                        Text("Saved Lists sync to your account so you can build collections of problems across your devices. Sign in from Settings to start.")
                    }
                }
            }
            .navigationTitle("Lists")
            .toolbar {
                if available {
                    ToolbarItem(placement: .primaryAction) {
                        Button { showingCreate = true } label: {
                            Image(systemName: "plus")
                        }
                        .accessibilityLabel("New list")
                    }
                }
            }
            .sheet(isPresented: $showingCreate) { CreateListSheet() }
            .alert("Rename list", isPresented: renamingBinding) {
                TextField("Name", text: $renameText)
                Button("Save") { commitRename() }
                Button("Cancel", role: .cancel) { renaming = nil }
            }
            .alert("Something went wrong", isPresented: errorBinding) {
                Button("OK") { loadError = nil }
            } message: {
                Text(loadError ?? "")
            }
        }
    }

    @ViewBuilder
    private var index: some View {
        if lists.myLists.isEmpty {
            ContentUnavailableView {
                Label("No lists yet", systemImage: "bookmark")
            } description: {
                Text("Create a list to start saving problems — projects, ticklists, warmups.")
            } actions: {
                Button("Create a list") { showingCreate = true }
            }
            .task { await load() }
        } else {
            List {
                ForEach(lists.myLists) { list in
                    NavigationLink {
                        ListDetailView(listId: list.id)
                    } label: {
                        row(list)
                    }
                    .swipeActions(edge: .trailing) {
                        Button(role: .destructive) {
                            Task { await delete(list.id) }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                        Button {
                            startRename(list)
                        } label: {
                            Label("Rename", systemImage: "pencil")
                        }
                        .tint(.indigo)
                    }
                }
            }
            .refreshable { await load() }
            .task { await load() }
        }
    }

    private func row(_ list: ListRow) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(list.name.isEmpty ? "Untitled list" : list.name)
            Text(Board.with(layoutId: list.board_layout_id).name)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
    }

    // MARK: - Rename plumbing

    private var renamingBinding: Binding<Bool> {
        Binding(get: { renaming != nil }, set: { if !$0 { renaming = nil } })
    }

    private var errorBinding: Binding<Bool> {
        Binding(get: { loadError != nil }, set: { if !$0 { loadError = nil } })
    }

    private func startRename(_ list: ListRow) {
        renameText = list.name
        renaming = list
    }

    private func commitRename() {
        guard let list = renaming else { return }
        renaming = nil
        let name = renameText
        Task {
            do { try await lists.renameList(list.id, name: name) }
            catch { loadError = error.localizedDescription }
        }
    }

    // MARK: - Actions

    private func load() async {
        guard available else { return }
        do { try await lists.loadMyLists() }
        catch { loadError = error.localizedDescription }
    }

    private func delete(_ listId: UUID) async {
        do { try await lists.deleteList(listId) }
        catch { loadError = error.localizedDescription }
    }
}

/// Create-list sheet: name + board. The creator is seated as the first member by a DB
/// trigger, so the new list is immediately usable. The name field offers quick-fill
/// suggestion pills, and the board is chosen from the user's *added* boards using the same
/// card style as the Home tab's Boards section.
private struct CreateListSheet: View {
    @EnvironmentObject private var lists: ListsManager
    @Environment(\.dismiss) private var dismiss
    @AppStorage(AddedBoards.storageKey) private var addedCSV = ""
    @AppStorage(ActiveBoard.storageKey) private var activeBoardId = ActiveBoard.default

    @State private var name = ""
    @State private var boardId = ActiveBoard.default
    @State private var isSaving = false
    @State private var error: String?

    private var addedBoards: [Board] { AddedBoards.boards(from: addedCSV) }

    /// Quick-fill name ideas — today's date plus a few common list purposes.
    private var nameSuggestions: [String] {
        let today = Date.now.formatted(.dateTime.month(.abbreviated).day())
        return [today, "Projects", "To-do", "Warmups", "Ticklist", "Flashed"]
    }

    private var canCreate: Bool {
        !name.trimmingCharacters(in: .whitespaces).isEmpty
            && !isSaving
            && addedBoards.contains { $0.id == boardId }
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Name") {
                    TextField("e.g. Projects", text: $name)
                    suggestionPills
                }
                Section("Board") {
                    if addedBoards.isEmpty {
                        Text("Add a board on the Home tab to create a list.")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(addedBoards) { board in
                            BoardPickerCard(board: board, isSelected: board.id == boardId) {
                                boardId = board.id
                            }
                        }
                    }
                }
                if let error {
                    Text(error).foregroundStyle(.red).font(.footnote)
                }
            }
            .navigationTitle("New list")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") { create() }.disabled(!canCreate)
                }
            }
            .onAppear {
                // Default to the active board when it's added, else the first added board.
                if !addedBoards.contains(where: { $0.id == boardId }) {
                    boardId = addedBoards.first { $0.id == activeBoardId }?.id
                        ?? addedBoards.first?.id
                        ?? boardId
                }
            }
        }
    }

    private var suggestionPills: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(nameSuggestions, id: \.self) { suggestion in
                    Button {
                        name = suggestion
                    } label: {
                        Text(suggestion)
                            .font(.caption.weight(.medium))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Color(.systemGray5), in: Capsule())
                            .foregroundStyle(.primary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
        .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 8, trailing: 16))
    }

    private func create() {
        isSaving = true
        error = nil
        Task {
            do {
                try await lists.createList(name: name, boardLayoutId: boardId)
                dismiss()
            } catch {
                self.error = error.localizedDescription
                isSaving = false
            }
        }
    }
}

/// A selectable board card for the create-list sheet — the same thumbnail + name as the
/// Home tab's board rows (rendering only the board's active hold sets), with a selection
/// checkmark instead of the navigation chevron.
private struct BoardPickerCard: View {
    let board: Board
    let isSelected: Bool
    let onTap: () -> Void
    @AppStorage private var activeCSV: String

    init(board: Board, isSelected: Bool, onTap: @escaping () -> Void) {
        self.board = board
        self.isSelected = isSelected
        self.onTap = onTap
        _activeCSV = AppStorage(wrappedValue: "", board.activeHoldSetsKey)
    }

    private var renderIDs: Set<Int> {
        ActiveHoldSets.visible(ActiveHoldSets.ids(from: activeCSV, in: board), in: board)
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                BoardImageView(setup: board.setup, visibleHoldSetIDs: renderIDs)
                    .frame(width: 72)
                    .allowsHitTesting(false)
                Text(board.name)
                    .fontWeight(isSelected ? .semibold : .regular)
                Spacer()
                Image(systemName: isSelected ? "checkmark.circle.fill" : "circle")
                    .font(.title3)
                    .foregroundStyle(isSelected ? Color.accentColor : Color(.systemGray3))
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
