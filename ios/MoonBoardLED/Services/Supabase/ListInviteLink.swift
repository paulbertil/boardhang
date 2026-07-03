import Foundation

/// Builds and parses the share-link deep link for joining a collaborative list. Reuses
/// the app's already-registered custom scheme (`com.boardly`, also used for
/// auth-callback), so no new URL type or Info.plist entry is needed:
///
///     com.boardly://join?token=<invite_token uuid>
///
/// Pure and side-effect-free so it can be unit-checked without the app running.
enum ListInviteLink {
    static let scheme = "com.boardly"
    static let host = "join"

    /// The shareable link for a list's invite token.
    static func url(for token: UUID) -> URL? {
        var comps = URLComponents()
        comps.scheme = scheme
        comps.host = host
        comps.queryItems = [URLQueryItem(name: "token", value: token.uuidString)]
        return comps.url
    }

    /// The invite token iff `url` is a well-formed join link, else nil — so unrelated
    /// deep links (e.g. `com.boardly://auth-callback`) are ignored rather than mis-routed.
    static func token(from url: URL) -> UUID? {
        guard let comps = URLComponents(url: url, resolvingAgainstBaseURL: false),
              comps.scheme == scheme,
              comps.host == host,
              let raw = comps.queryItems?.first(where: { $0.name == "token" })?.value
        else { return nil }
        return UUID(uuidString: raw)
    }
}
