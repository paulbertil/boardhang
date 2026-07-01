import Foundation

/// Read-only catalog of official Mini MoonBoard 2025 problems, loaded from the
/// bundled `MiniMoonBoard2025Catalog.json` (produced by `scripts/fetch_mini2025.py`).
///
/// This is deliberately kept separate from the user's own SwiftData `Problem`s:
/// the catalog is browse-and-light only, never edited or persisted.
struct Catalog: Decodable {
    var setup: String
    var holdsetup: Int
    var count: Int
    var problems: [CatalogProblem]

    static let empty = Catalog(setup: "Mini MoonBoard 2025", holdsetup: 22, count: 0, problems: [])

    /// Loaded once from the app bundle. Returns an empty catalog if the JSON
    /// hasn't been bundled yet (i.e. before the fetch script has been run).
    static let shared: Catalog = load()

    private static func load() -> Catalog {
        guard let url = Bundle.main.url(forResource: "MiniMoonBoard2025Catalog", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            return .empty
        }
        do {
            return try JSONDecoder().decode(Catalog.self, from: data)
        } catch {
            assertionFailure("Failed to decode catalog: \(error)")
            return .empty
        }
    }
}

/// One official problem. The current MoonBoard API encodes start / left / right /
/// end roles, which map directly onto `HoldType` (no `match` appears in the data).
struct CatalogProblem: Decodable, Identifiable, Hashable {
    var id: String
    var name: String
    var grade: String
    var userGrade: String?
    var setter: String
    var stars: Int
    var repeats: Int
    var isBenchmark: Bool
    /// MoonBoard foot-rule method (e.g. "Footless", "No kickboard"); nil for
    /// standard problems. Optional so older bundled catalogs still decode.
    var method: String?
    var holds: [CatalogHold]

    /// Convert to the app's hold model so it can be rendered and lit on the board.
    var holdAssignments: [HoldAssignment] {
        holds.map { HoldAssignment(col: $0.col, row: $0.row, type: $0.holdType) }
    }
}

struct CatalogHold: Decodable, Hashable {
    var c: Int   // column 0...10 (A...K)
    var r: Int   // row 1...12 (1 = bottom)
    var t: String  // "start" | "left" | "right" | "match" | "end"

    var col: Int { c }
    var row: Int { r }

    var holdType: HoldType {
        switch t {
        case "start": return .start
        case "left":  return .left
        case "match": return .match
        case "end":   return .end
        default:      return .right
        }
    }
}
