# MoonBoard LED — Handoff / Context

Context document for an agent (or developer) picking this up. Pairs with `README.md`
(user-facing run instructions). Read this first.

## What this is & why it exists

A **native iOS app** (SwiftUI + CoreBluetooth + SwiftData) that creates climbing
problems and lights them on a **DIY MoonBoard LED system** over Bluetooth.

The user has a **Mini MoonBoard 2025** (11 columns A–K × 12 rows = 132 holds) with a
home-built LED strip driven by an **Arduino** running the firmware
[FabianRig/ArduinoMoonBoardLED](https://github.com/FabianRig/ArduinoMoonBoardLED).
The official MoonBoard iOS app broke their LEDs after an update (only ~4 LEDs lit per
problem — see "The 20-byte bug" below), and it's buggy generally. This app replaces it.
The Arduino firmware is **unchanged**; the app just speaks its BLE protocol correctly.

Scope is an MVP: **no login, no import of official problems, Mini 2025 only, iOS only.**
These were deliberate decisions (multiplatform and auth were explicitly dropped).

## How to build / verify

- **Xcode 26.0.1, Swift 5 language mode** (`SWIFT_VERSION = 5.0`), **iOS 17** target.
- The `.xcodeproj` uses an Xcode-16 **filesystem-synchronized group** — source files in
  `MoonBoardLED/` are auto-included; you do **not** add them to a Sources build phase.
- Build check (no device/signing needed):
  ```
  xcodebuild -project MoonBoardLED.xcodeproj -scheme MoonBoardLED \
    -destination 'generic/platform=iOS Simulator' -configuration Debug \
    build CODE_SIGNING_ALLOWED=NO
  ```
- Runs on the user's iPhone via a **free Apple ID** (`DEVELOPMENT_TEAM` is set;
  7-day signing). BLE does **not** work in the Simulator — only on a real device.

## The BLE protocol (verified against firmware source)

- **Nordic UART Service.** Service `6E400001-…`, **write** characteristic `6E400002-…`
  (write-without-response only). Board advertises as `"MoonBoard A"` (user-configurable).
- **Message:** `l#` + comma-separated `<TypeLetter><ledIndex>` + `#`.
  Example: `l#S0,R14,E131#`. Empty / clear = `l##`.
- **Type letters:** `S`=start, `L`=left, `R`=right, `M`=match, `E`=end. (Firmware also
  treats `P` as a move/blue; we use `R`.) Firmware colors: S green, L violet, R blue,
  M pink, E red.
- **LED index** = 0-based position along the serpentine strip. For the Mini the firmware
  maps hold number → LED 1:1, so the number we send *is* the physical LED.

### ⚠️ The 20-byte bug (most important gotcha)

The firmware's RX characteristic is declared with **max length 20 bytes**
(`BLE_ATTRIBUTE_MAX_VALUE_LENGTH` in `ArduinoMultiUserHardwareBLESerial`) and **silently
truncates** anything longer. Modern iPhones negotiate a large MTU, so a naive single
`writeValue` of the whole string only delivers the first ~20 bytes (~4 holds) — the rest
are dropped. **This was the exact bug that also broke the official app.**

Fix (in `MoonBoardBLEManager.write` / `sendNextChunks`): split every message into
**≤20-byte chunks** and send them as write-without-response packets **with flow control**
(`canSendWriteWithoutResponse` + `peripheralIsReady(toSendWriteWithoutResponse:)`), priming
the first chunk. The firmware reassembles chunks in its 256-byte ring buffer. Do **not**
use `maximumWriteValueLength` for sizing — it's the trap.

## Hold → LED mapping (the other thing that must be right)

In `Board/BoardGeometry.swift`. Serpentine, 12 LEDs/column, LED 0 = A1 (bottom-left):
- even columns (A,C,E,G,I,K): bottom→top, `led = col*12 + (row-1)`
- odd columns (B,D,F,H,J): top→bottom, `led = col*12 + (12-row)`
- `flipped` (AppStorage `boardOrientationFlipped`) reverses the whole strip if the board
  is wired from the other end.

**Verify against the physical board** via the in-app **LED Test** screen (steps one LED
at a time, highlights the expected hold, has the flip toggle). The formula was derived
from the firmware's `additionalledmapping`, but only hardware testing confirms it for a
given wiring.

## Architecture / files (all under `MoonBoardLED/`)

- `MoonBoardApp.swift` — app entry; `@StateObject` BLE manager; `.modelContainer(for: Problem.self)`.
- `Models/HoldType.swift` — enum `start/left/right/match/end`; `protocolLetter`, `color`,
  `label`; `displayed(showBeta:)` collapses left/right/match → `.right` when beta is off.
- `Models/Problem.swift` — SwiftData `@Model` (name, grade, createdAt, `holds:[HoldAssignment]`);
  `FontGrade.all` list. `HoldAssignment{col,row,type}` is in `HoldType.swift`.
- `Board/BoardGeometry.swift` — grid constants, `ledIndex`, `position(forLED:)`, and the
  **background-image layout** (normalized hold-center fractions for the 1024×1024 photo).
- `Board/BoardGridView.swift` — reusable board: photo backdrop (`BoardBackground` asset) +
  tappable markers; colored ring/fill + (beta-only) type label per selected hold; `highlight`
  for LED test; `showBeta` param.
- `BLE/MoonBoardBLEManager.swift` — CoreBluetooth central; scan by NUS UUID; auto-reconnect
  (last device in UserDefaults); `message/send/sendDebounced(holds:flipped:showBeta:)`;
  chunked flow-controlled writes; `clear()`; `lightSingleLED()`.
- `Views/ProblemListView.swift` — home: list (swipe-to-delete), menu (New, LED Test, Clear Board),
  connection status button.
- `Views/ProblemEditView.swift` — create/edit; **brush palette + Auto mode** (see below);
  live preview to board (debounced) while editing; `showBeta` toggle.
- `Views/ProblemDetailView.swift` — view a saved problem; Light up / Clear; **Show beta**
  toggle; ⋯ menu with Edit and Delete (confirmation).
- `Views/ConnectionView.swift` — scan/connect sheet.
- `Views/LEDTestView.swift` — calibration.
- `Assets.xcassets/BoardBackground.imageset/board.png` — the Mini 2025 setup photo (1024×1024).

## Editor interaction model (current behavior)

- **Show beta** (`@AppStorage("showBeta")`, default true) is global. On: all 5 types &
  labels & extra colors. Off: only green/blue/red (left/right/match all render & light as blue),
  no labels. The toggle lives in the **editor** and the **detail** screen (removed from home).
- **Palette brush**: "Auto" + one chip per type (Left/Match hidden when beta off).
  - With a brush selected: tap paints that type; tap same type again removes it.
  - **Auto** (no brush): first tap uses smart defaults — top row → End(red); first two
    non-top holds → Start(green); rest → Right(blue). Re-tapping cycles:
    - non-top, beta on: start→right→left→match→end→off
    - non-top, beta off: start→right→end→off
    - top row, beta on: end→right→left→match→off (never Start)
    - top row, beta off: end→right→off
- **Start (green) is never allowed on the top row** (row 12).

## Known gotchas

- **SwiftData enum-rename crash.** Renaming/removing a `HoldType` case makes old saved
  problems undecodable → fatal `DecodingError` on launch. There is **no migration shim**
  (we removed one deliberately). If you change `HoldType` raw values, the user must delete
  the app from the device to wipe the SwiftData store (or add migration handling).
- **Swift 6 concurrency warnings.** `MoonBoardBLEManager` is `@MainActor` conforming to the
  CoreBluetooth delegate protocols → "crosses into main actor-isolated code" warnings. Benign
  in Swift 5 mode (central uses the main queue, so callbacks are already on main). Would be
  errors under Swift 6 language mode.
- **Image alignment** is calibrated by four fractions in `BoardGeometry` (firstColXFrac,
  colStepXFrac, topRowYFrac, rowStepYFrac). If a new board photo is swapped in, re-tune these
  and `imageAspect`.

## Open / deferred (not done)

- `~D` "LEDs above holds" firmware option (we always send `l#…#`, no `~D` prefix).
- Importing official MoonBoard problems; login/cloud sync; multiplatform.
- App icon is a placeholder (empty AppIcon set).
- Hold→LED mapping not yet hardware-confirmed by the user as of this writing — LED Test is
  the tool to confirm/flip it.

## Related references

- User-facing run guide: `README.md`
- Plan file: `~/.claude/plans/hey-claude-i-want-deep-lightning.md`
- Agent memory: `~/.claude/projects/-Users-bertilskeppar-projects-board-app/memory/`
- Firmware: https://github.com/FabianRig/ArduinoMoonBoardLED
- BLE-serial lib: https://github.com/FabianRig/ArduinoMultiUserHardwareBLESerial
