import SwiftUI

/// Renders the Mini 2025 board using the real setup photo as the backdrop, with a
/// tappable marker over each of the 132 holds. Selected holds get a colored ring +
/// translucent fill; unselected holds stay invisible (but tappable) so the photo
/// reads cleanly. Reused in the editor (tappable), the read-only detail view, and
/// the LED test screen (via `highlight`).
struct BoardGridView: View {
    /// Map of "col-row" → assignment for O(1) lookup while rendering.
    let assignments: [String: HoldAssignment]
    /// Called when a hold is tapped (nil = read-only).
    var onTap: ((Int, Int) -> Void)? = nil
    /// Optional highlight ring (used by the LED test screen).
    var highlight: (col: Int, row: Int)? = nil
    /// Beta off collapses left/right/match to blue.
    var showBeta: Bool = true

    private let cols = BoardGeometry.columns
    private let rows = BoardGeometry.rows

    init(holds: [HoldAssignment],
         onTap: ((Int, Int) -> Void)? = nil,
         highlight: (col: Int, row: Int)? = nil,
         showBeta: Bool = true) {
        self.assignments = Dictionary(uniqueKeysWithValues: holds.map { ("\($0.col)-\($0.row)", $0) })
        self.onTap = onTap
        self.highlight = highlight
        self.showBeta = showBeta
    }

    var body: some View {
        ZStack {
            Image("BoardBackground")
                .resizable()
                .aspectRatio(contentMode: .fit)

            GeometryReader { geo in
                let w = geo.size.width
                let h = geo.size.height
                let marker = BoardGeometry.colStepXFrac * w * 0.92
                ForEach(0..<cols, id: \.self) { col in
                    ForEach(1...rows, id: \.self) { row in
                        holdMarker(col: col, row: row, size: marker)
                            .position(x: BoardGeometry.normX(col: col) * w,
                                      y: BoardGeometry.normY(row: row) * h)
                    }
                }
            }
        }
        .aspectRatio(BoardGeometry.imageAspect, contentMode: .fit)
    }

    @ViewBuilder
    private func holdMarker(col: Int, row: Int, size: CGFloat) -> some View {
        let assignment = assignments["\(col)-\(row)"]
        let shownType = assignment?.type.displayed(showBeta: showBeta)
        let shownColor = shownType?.color
        let isHighlighted = highlight.map { $0.col == col && $0.row == row } ?? false
        let ringColor: Color = isHighlighted ? .orange : (shownColor ?? .clear)
        let ringWidth: CGFloat = isHighlighted ? 4 : (assignment == nil ? 0 : 3.5)

        Circle()
            .fill((shownColor ?? .clear).opacity(assignment == nil ? 0 : 0.35))
            .frame(width: size, height: size)
            .overlay(Circle().strokeBorder(ringColor, lineWidth: ringWidth))
            .shadow(color: .black.opacity(assignment == nil && !isHighlighted ? 0 : 0.5), radius: 1)
            .overlay(alignment: .bottom) {
                if showBeta, let shownType {
                    Text(shownType.label)
                        .font(.system(size: max(8, size * 0.34), weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 4).padding(.vertical, 1)
                        .background(shownType.color.opacity(0.9), in: Capsule())
                        .fixedSize()
                        .offset(y: size * 0.62)
                }
            }
            .contentShape(Circle())
            .onTapGesture { onTap?(col, row) }
            .allowsHitTesting(onTap != nil)
    }
}
