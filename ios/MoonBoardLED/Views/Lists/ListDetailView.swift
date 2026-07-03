import SwiftUI

/// A single collaborative list: its members, its shared problem pile with per-person
/// send/try badges, and leave/delete actions. Group status is refresh-first (fetched on
/// open + pull-to-refresh). Catalog names are resolved locally from the list's board.
///
/// (The "Browse & add" entry point and share/invite live in U8 and U7 respectively.)
struct ListDetailView: View {
    let listId: UUID

    @EnvironmentObject private var lists: ListsManager
    @Environment(\.dismiss) private var dismiss

    @State private var catalogByID: [String: CatalogProblem] = [:]
    @State private var actionError: String?
    @State private var showingBrowse = false

    private var list: ListRow? {
        lists.currentList?.id == listId ? lists.currentList : lists.myLists.first { $0.id == listId }
    }

    private var isOwner: Bool {
        guard let list, let me = lists.myUserID else { return false }
        return list.owner_id == me
    }

    var body: some View {
        List {
            browseSection
            inviteSection
            membersSection
            pileSection
        }
        .sheet(isPresented: $showingBrowse, onDismiss: { Task { await refresh() } }) {
            ListBrowseView(listId: listId, boardLayoutId: list?.board_layout_id ?? 7)
        }
        .navigationTitle(list.map { $0.name.isEmpty ? "List" : $0.name } ?? "List")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Menu {
                    Button(role: .destructive) {
                        Task { await leave() }
                    } label: {
                        Label("Leave list", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                    if isOwner {
                        Button(role: .destructive) {
                            Task { await deleteList() }
                        } label: {
                            Label("Delete list", systemImage: "trash")
                        }
                    }
                } label: {
                    Image(systemName: "ellipsis.circle")
                }
            }
        }
        .refreshable { await refresh() }
        .task {
            await refresh()
            await loadCatalog()
        }
        .alert("Something went wrong", isPresented: .constant(actionError != nil)) {
            Button("OK") { actionError = nil }
        } message: {
            Text(actionError ?? "")
        }
    }

    // MARK: - Sections

    private var browseSection: some View {
        Section {
            Button {
                showingBrowse = true
            } label: {
                Label("Browse & add problems", systemImage: "plus.magnifyingglass")
            }
        }
    }

    @ViewBuilder
    private var inviteSection: some View {
        if let list, let url = ListInviteLink.url(for: list.invite_token) {
            Section {
                ShareLink(item: url) {
                    Label("Share invite link", systemImage: "square.and.arrow.up")
                }
            } footer: {
                Text("Anyone with this link can join and share their send/try status with the group.")
            }
        }
    }

    private var membersSection: some View {
        Section("Members") {
            if lists.members.isEmpty {
                Text("No members yet").foregroundStyle(.secondary)
            } else {
                ForEach(lists.members) { member in
                    HStack {
                        MemberInitial(handle: member.handle)
                        Text("@\(member.handle)")
                        Spacer()
                        if member.id == list?.owner_id {
                            Text("owner").font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private var pileSection: some View {
        Section("Problems") {
            if lists.pile.isEmpty {
                Text("No problems added yet.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(lists.pile) { item in
                    VStack(alignment: .leading, spacing: 6) {
                        Text(catalogByID[item.source_catalog_id]?.name ?? item.source_catalog_id)
                        perPersonBadges(catalogID: item.source_catalog_id)
                    }
                }
            }
        }
    }

    /// One small dot per member, colored by their status for this problem:
    /// green = sent, orange = tried (not sent), gray = untouched.
    private func perPersonBadges(catalogID: String) -> some View {
        HStack(spacing: 6) {
            ForEach(lists.members) { member in
                MemberInitial(
                    handle: member.handle,
                    color: memberStatusColor(lists.groupStatus[member.id], catalogID: catalogID),
                    compact: true
                )
            }
        }
    }

    // MARK: - Actions

    private func refresh() async {
        do {
            try await lists.loadDetail(listId)
            try await lists.refreshGroupStatus(listId: listId)
        } catch {
            actionError = error.localizedDescription
        }
    }

    private func loadCatalog() async {
        guard let list else { return }
        let board = Board.with(layoutId: list.board_layout_id)
        let resource = board.catalogResource(angle: board.defaultAngle)
        let catalog = await Task.detached { Catalog.load(resource: resource) }.value
        var map: [String: CatalogProblem] = [:]
        for problem in catalog.problems { map[problem.id] = problem }
        catalogByID = map
    }

    private func leave() async {
        do { try await lists.leaveList(listId); dismiss() }
        catch { actionError = error.localizedDescription }
    }

    private func deleteList() async {
        do { try await lists.deleteList(listId); dismiss() }
        catch { actionError = error.localizedDescription }
    }
}
