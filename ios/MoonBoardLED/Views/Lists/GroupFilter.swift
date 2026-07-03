import Foundation

/// The per-person group filter — the heart of collaborative lists. It answers "which
/// catalog problems match the group status I've selected?" using the rule the brainstorm
/// settled on:
///
///   • **More people = stricter** — AND across members: every member you've picked must
///     match.
///   • **More buckets for one person = looser** — OR within a member: any one of that
///     member's selected buckets matching is enough.
///
/// So `Not completed → [everyone]` returns problems nobody has sent (projects +
/// never-touched) — the headline query. No selection = passes (browse opens unfiltered).
enum StatusBucket: String, CaseIterable, Identifiable {
    case completed
    case projects
    case notCompleted

    var id: String { rawValue }

    var label: String {
        switch self {
        case .completed:    return "Completed"
        case .projects:     return "Projects"
        case .notCompleted: return "Not completed"
        }
    }
}

/// One selected chip: "this member, in this bucket".
struct GroupChip: Hashable {
    let memberID: UUID
    let bucket: StatusBucket
}

enum GroupFilter {

    /// Whether a single member's status puts a catalog problem in the given bucket.
    /// Mirrors the solo `CatalogFilter` semantics exactly (completed = sent; projects =
    /// tried-not-sent; notCompleted = !sent). An absent/empty status means untouched,
    /// which is "not completed".
    static func matches(bucket: StatusBucket, catalogID: String, status: MemberStatus) -> Bool {
        switch bucket {
        case .completed:    return status.sent.contains(catalogID)
        case .projects:     return status.tried.contains(catalogID) && !status.sent.contains(catalogID)
        case .notCompleted: return !status.sent.contains(catalogID)
        }
    }

    /// Apply the whole selection to one catalog id. OR within a member's buckets, AND
    /// across members. Empty selection passes everything (unfiltered browse).
    static func passes(catalogID: String,
                       selection: Set<GroupChip>,
                       status: [UUID: MemberStatus]) -> Bool {
        guard !selection.isEmpty else { return true }
        let byMember = Dictionary(grouping: selection, by: { $0.memberID })
        // AND across members: each selected member must have at least one matching bucket.
        for (memberID, chips) in byMember {
            let memberStatus = status[memberID] ?? MemberStatus()
            let anyMatch = chips.contains {
                matches(bucket: $0.bucket, catalogID: catalogID, status: memberStatus)
            }
            if !anyMatch { return false }
        }
        return true
    }
}
