import SwiftUI

/// Group-aware "Browse & add" for a list. Opens the list's board catalog **unfiltered**
/// (the group filter is opt-in, per the brainstorm). Under each status bucket you pick
/// which members it applies to — the per-person filter that surfaces problems the group
/// can climb together (e.g. Not completed → everyone = nobody's sent it). Tapping ＋ adds
/// a problem to the shared pile.
struct ListBrowseView: View {
    let listId: UUID
    let boardLayoutId: Int

    @EnvironmentObject private var lists: ListsManager
    @Environment(\.dismiss) private var dismiss

    @State private var problems: [CatalogProblem] = []
    @State private var loaded = false
    @State private var search = ""
    @State private var selection: Set<GroupChip> = []
    @State private var addedIDs: Set<String> = []
    @State private var addError: String?

    private var filtered: [CatalogProblem] {
        let status = lists.groupStatus
        let query = search
        let chips = selection
        return problems.filter { problem in
            let matchesSearch = query.isEmpty || problem.name.localizedCaseInsensitiveContains(query)
            guard matchesSearch else { return false }
            return GroupFilter.passes(catalogID: problem.id, selection: chips, status: status)
        }
    }

    var body: some View {
        NavigationStack {
            Group {
                if loaded {
                    List {
                        filterSection
                        Section(filtered.isEmpty ? "No matches" : "\(filtered.count) problems") {
                            ForEach(filtered) { row($0) }
                        }
                    }
                } else {
                    ProgressView().frame(maxWidth: .infinity, maxHeight: .infinity)
                }
            }
            .searchable(text: $search)
            .navigationTitle("Browse & add")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .task { await load() }
            .alert("Couldn't add", isPresented: .constant(addError != nil)) {
                Button("OK") { addError = nil }
            } message: {
                Text(addError ?? "")
            }
        }
    }

    private var filterSection: some View {
        Section {
            ForEach(StatusBucket.allCases) { bucket in
                VStack(alignment: .leading, spacing: 6) {
                    Text(bucket.label).font(.subheadline.weight(.semibold))
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(lists.members) { member in
                                chip(member: member, bucket: bucket)
                            }
                        }
                    }
                }
                .padding(.vertical, 2)
            }
        } header: {
            Text("Group filter")
        } footer: {
            Text("Pick people under a status. More people = stricter; one person under two statuses = looser.")
        }
    }

    private func chip(member: Profile, bucket: StatusBucket) -> some View {
        let gc = GroupChip(memberID: member.id, bucket: bucket)
        let on = selection.contains(gc)
        return Button {
            if on { selection.remove(gc) } else { selection.insert(gc) }
        } label: {
            Text("@\(member.handle)")
                .font(.caption.weight(.medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(on ? Color.accentColor : Color(.systemGray5), in: Capsule())
                .foregroundStyle(on ? .white : .primary)
        }
        .buttonStyle(.plain)
    }

    private func row(_ problem: CatalogProblem) -> some View {
        let added = addedIDs.contains(problem.id)
        return HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(problem.name)
                Text(problem.grade).font(.caption).foregroundStyle(.secondary)
                HStack(spacing: 6) {
                    ForEach(lists.members) { member in
                        MemberInitial(
                            handle: member.handle,
                            color: memberStatusColor(lists.groupStatus[member.id], catalogID: problem.id),
                            compact: true
                        )
                    }
                }
            }
            Spacer()
            Button {
                Task { await add(problem) }
            } label: {
                Image(systemName: added ? "checkmark.circle.fill" : "plus.circle")
                    .imageScale(.large)
                    .foregroundStyle(added ? .green : Color.accentColor)
            }
            .buttonStyle(.plain)
            .disabled(added)
        }
    }

    private func load() async {
        let board = Board.with(layoutId: boardLayoutId)
        let resource = board.catalogResource(angle: board.defaultAngle)
        let catalog = await Task.detached { Catalog.load(resource: resource) }.value
        problems = catalog.problems
        addedIDs = Set(lists.pile.map(\.source_catalog_id))
        loaded = true
    }

    private func add(_ problem: CatalogProblem) async {
        do {
            try await lists.addProblem(
                listId: listId,
                sourceCatalogID: problem.id,
                boardLayoutId: boardLayoutId
            )
            addedIDs.insert(problem.id)
        } catch {
            addError = error.localizedDescription
        }
    }
}
