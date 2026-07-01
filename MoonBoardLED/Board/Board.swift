import Foundation

/// A board the app supports end-to-end: its art/geometry (`MoonBoardSetup`), the
/// bundled problem catalog(s), hold-set membership, LED row count, and the
/// per-board `@AppStorage` keys for its settings. This is what parameterizes the
/// catalog, editor, lighting and calibration so they work for any board.
struct Board: Identifiable, Hashable {
    let setup: MoonBoardSetup
    /// Wall angles with a bundled catalog (e.g. [40] or [40, 25]).
    let angles: [Int]
    /// Bundled catalog resource base name.
    let catalogPrefix: String
    /// Bundled hold-set membership resource name.
    let membershipResource: String

    var id: Int { setup.id }
    var name: String { setup.name }
    /// LED row count for this board (Mini 12, full 18).
    var rows: Int { setup.geometry.rowTop }
    var hasAngleChoice: Bool { angles.count > 1 }
    var defaultAngle: Int { angles.first ?? 40 }

    /// Catalog resource for an angle. Single-angle boards ignore the suffix.
    func catalogResource(angle: Int) -> String {
        hasAngleChoice ? "\(catalogPrefix)_\(angle)" : catalogPrefix
    }

    func catalog(angle: Int) -> Catalog { Catalog.load(resource: catalogResource(angle: angle)) }

    // MARK: Per-board settings keys
    var activeHoldSetsKey: String { "activeHoldSets_\(id)" }
    var flippedKey: String { "flipped_\(id)" }
    var angleKey: String { "angle_\(id)" }

    // MARK: Hold-set membership
    var membership: HoldSetMembership { HoldSetMembership.load(resource: membershipResource) }

    /// Hold sets that own ≥1 numbered grid hold — the ones the filter/editor use.
    var filterableHoldSets: [MoonBoardHoldSet] {
        let owned = Set(membership.membership.values)
        return setup.holdSets.filter { owned.contains($0.id) }
    }

    /// Sets that own no grid holds (e.g. Screw-on Feet) — always rendered as art,
    /// never part of the filter.
    var alwaysOnHoldSetIDs: Set<Int> {
        let owned = Set(membership.membership.values)
        return Set(setup.holdSets.map(\.id)).subtracting(owned)
    }

    /// The picker's grade range: the contiguous span of the canonical Font scale
    /// that this board's catalog (at `angle`) actually uses.
    func gradeList(angle: Int) -> [String] {
        let present = Set(catalog(angle: angle).problems.map(\.grade))
        let idxs = present.compactMap { FontGrade.all.firstIndex(of: $0) }
        guard let lo = idxs.min(), let hi = idxs.max() else { return FontGrade.all }
        return Array(FontGrade.all[lo...hi])
    }

    static func == (a: Board, b: Board) -> Bool { a.id == b.id }
    func hash(into h: inout Hasher) { h.combine(id) }

    // MARK: Registry
    static let mini2025 = Board(
        setup: .mini2025, angles: [40],
        catalogPrefix: "MiniMoonBoard2025Catalog",
        membershipResource: "MiniMoonBoard2025HoldSets")

    static let masters2019 = Board(
        setup: MoonBoardSetup.with(id: 5)!, angles: [40, 25],
        catalogPrefix: "MoonBoardMasters2019Catalog",
        membershipResource: "MoonBoardMasters2019HoldSets")

    /// Boards shown in the Home "Boards" section, in order.
    static let all: [Board] = [mini2025, masters2019]

    static func with(layoutId: Int) -> Board { all.first { $0.id == layoutId } ?? mini2025 }
}

/// Resolves a logged ascent's `sourceCatalogID` back to its board + problem, across
/// every bundled board/angle, so the logbook can render and navigate any ascent
/// regardless of which board it came from. Built once.
enum CatalogIndex {
    struct Entry { let board: Board; let problem: CatalogProblem }

    static let shared: [String: Entry] = {
        var idx: [String: Entry] = [:]
        for board in Board.all {
            for angle in board.angles {
                for p in board.catalog(angle: angle).problems where idx[p.id] == nil {
                    idx[p.id] = Entry(board: board, problem: p)
                }
            }
        }
        return idx
    }()

    static func entry(forCatalogID id: String?) -> Entry? {
        guard let id else { return nil }
        return shared[id]
    }
}
