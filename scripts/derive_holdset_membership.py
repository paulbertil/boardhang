#!/usr/bin/env python3
"""
Derive which hold set each Mini MoonBoard 2025 grid position belongs to, by
sampling the per-hold-set overlay PNGs' alpha channel.

WHY
---
Neither the bundled catalog nor boardsesh records per-hold set membership for
MoonBoard (boardsesh only tracks set_id per hole for Kilter/Tension; it skips the
set filter for board_name == 'moonboard'). But the imported board art gives it to
us implicitly: each hold set is a transparent overlay that paints only its own
holds. So for every grid cell, the set whose overlay is opaque there owns that
hold. On the Mini 2025 the sets partition cleanly (128 holds, no overlaps).

This lets the app answer "which problems can I climb with only these hold sets
installed?" — a problem is climbable iff every one of its holds is owned by an
active set (see CatalogListView / HoldSetMembership).

Output: MoonBoardLED/Resources/MiniMoonBoard2025HoldSets.json
    { "holdsetup": 22,
      "sets": [ {"id":28,"name":"Hold Set F"}, ... ],
      "membership": { "col-row": setId, ... } }   # col 0-10, row 1-12 (1=bottom)

Requires Pillow:  python3 -m pip install --break-system-packages Pillow
"""

import json
import os
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow required: python3 -m pip install --break-system-packages Pillow")

ASSETS = os.path.join(os.path.dirname(__file__), "..", "MoonBoardLED",
                      "Assets.xcassets", "Boards", "minimoonboard2025")
OUT = os.path.join(os.path.dirname(__file__), "..", "MoonBoardLED", "Resources",
                   "MiniMoonBoard2025HoldSets.json")

# (setId, display name, overlay basename) — ids match MoonBoardSetup.mini2025.
SETS = [
    (28, "Hold Set F", "holdsetf"),
    (29, "Original School Holds", "originalschoolholds"),
    (30, "Wooden Holds B", "woodenholdsb"),
    (31, "Wooden Holds C", "woodenholdsc"),
]

# Mini geometry (must match MoonBoardGeometry.mini in the app).
COLS, ROW_TOP, ROWS = 11, 12, 12
L, R, T, B = 0.1047, 0.0508, 0.0793, 0.0571
ALPHA_THRESHOLD = 60  # a cell "has a hold" in a set if its center is this opaque


def center_px(col, row, w, h):
    gw, gh = 1 - L - R, 1 - T - B
    x = L + (col + 0.5) / COLS * gw
    y = T + ((ROW_TOP - row) + 0.5) / ROWS * gh
    return int(x * w), int(y * h)


def max_alpha(px, w, h, cx, cy):
    """Max alpha in a small window around the cell center (robust to nudges)."""
    a = 0
    for dx in range(-6, 7, 3):
        for dy in range(-6, 7, 3):
            xx = min(max(cx + dx, 0), w - 1)
            yy = min(max(cy + dy, 0), h - 1)
            a = max(a, px[xx, yy][3])
    return a


def main():
    membership = {}
    conflicts = []
    counts = {}
    for set_id, name, basename in SETS:
        path = os.path.join(ASSETS, f"{basename}.imageset", f"{basename}.png")
        im = Image.open(path).convert("RGBA")
        w, h = im.size
        px = im.load()
        n = 0
        for col in range(COLS):
            for row in range(1, ROW_TOP + 1):
                cx, cy = center_px(col, row, w, h)
                if max_alpha(px, w, h, cx, cy) > ALPHA_THRESHOLD:
                    key = f"{col}-{row}"
                    if key in membership and membership[key] != set_id:
                        conflicts.append((key, membership[key], set_id))
                    membership[key] = set_id
                    n += 1
        counts[name] = n

    if conflicts:
        print(f"WARNING: {len(conflicts)} cells claimed by >1 set: {conflicts[:8]}")

    out = {
        "holdsetup": 22,
        "sets": [{"id": i, "name": nm} for i, nm, _ in SETS],
        "membership": dict(sorted(membership.items())),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(os.path.abspath(OUT), "w") as f:
        json.dump(out, f, ensure_ascii=False, indent=0)

    print("per-set hold counts:", counts)
    print(f"total classified cells: {len(membership)} / {COLS * ROW_TOP}")
    print(f"wrote {os.path.abspath(OUT)}")


if __name__ == "__main__":
    main()
