import SwiftUI

/// A small circular avatar-substitute showing a handle's first letter. Used for the
/// member roster and the per-person status dots (colored variant) in both the list
/// detail and the group-aware browse.
struct MemberInitial: View {
    let handle: String
    var color: Color = .accentColor
    var compact: Bool = false

    private var letter: String {
        String(handle.first ?? "?").uppercased()
    }

    var body: some View {
        Text(letter)
            .font(compact ? .caption2.weight(.bold) : .footnote.weight(.semibold))
            .foregroundStyle(.white)
            .frame(width: compact ? 20 : 28, height: compact ? 20 : 28)
            .background(color, in: Circle())
    }
}

/// The status color for a member on a given catalog problem: green = sent, orange =
/// tried (not sent), gray = untouched. Shared by the pile rows and browse rows.
func memberStatusColor(_ status: MemberStatus?, catalogID: String) -> Color {
    if status?.sent.contains(catalogID) == true { return .green }
    if status?.tried.contains(catalogID) == true { return .orange }
    return Color(.systemGray4)
}
