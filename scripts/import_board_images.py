#!/usr/bin/env python3
"""
Import MoonBoard board-art images (background + per-hold-set overlays) from the
boardsesh repo into this app's asset catalog.

WHY BOARDSESH
-------------
boardsesh renders MoonBoards by stacking transparent PNG layers: one shared board
background per board family + one overlay per hold set. Those layer PNGs are the
only openly-available per-hold-set board art, and cover every MoonBoard setup:
    packages/web/public/images/moonboard/
        moonboard-bg.png / minimoonboard-bg.png     (empty grids)
        <layout-folder>/<holdset>.png                (transparent hold-set layers)
The set-id -> image mapping lives in boardsesh's MOONBOARD_SETS; we mirror it in
Board/MoonBoardSetup.swift.

WHAT THIS DOES
--------------
Copies those PNGs into MoonBoardLED/Assets.xcassets/Boards/ as imagesets:
    Boards/                        (provides-namespace)
        minimoonboard-bg.imageset/
        moonboard-bg.imageset/
        <layout-folder>/           (provides-namespace; e.g. moonboard2016)
            holdseta.imageset/ ...
Referenced from Swift as Image("Boards/minimoonboard-bg"),
Image("Boards/moonboard2016/holdseta"), etc. Namespacing is required because hold-
set basenames (holdseta, originalschoolholds, ...) repeat across layouts.

Adding imagesets to an existing .xcassets needs NO project.pbxproj change — Xcode
picks them up automatically.

USAGE
-----
  # against an existing boardsesh checkout:
  python3 scripts/import_board_images.py --src /path/to/boardsesh

  # or let it shallow+sparse clone boardsesh into a temp dir:
  python3 scripts/import_board_images.py
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile

REPO = "https://github.com/boardsesh/boardsesh.git"
IMG_SUBPATH = os.path.join("packages", "web", "public", "images", "moonboard")

# Board-art folders to import (everything except the empty thumbs/ dir). The two
# shared background PNGs live at the top of the moonboard image dir.
BACKGROUNDS = ["moonboard-bg.png", "minimoonboard-bg.png"]
LAYOUT_FOLDERS = [
    "moonboard2010", "moonboard2016", "moonboard2024",
    "moonboardmasters2017", "moonboardmasters2019",
    "minimoonboard2020", "minimoonboard2025",
]

# Single-scale universal imageset (these are illustrations, not @2x/@3x raster).
NAMESPACE_CONTENTS = {"info": {"author": "xcode", "version": 1},
                      "properties": {"provides-namespace": True}}


def imageset_contents(filename):
    return {"images": [{"filename": filename, "idiom": "universal"}],
            "info": {"author": "xcode", "version": 1}}


def write_json(path, obj):
    with open(path, "w") as f:
        json.dump(obj, f, indent=2)
        f.write("\n")


def sparse_clone():
    tmp = tempfile.mkdtemp(prefix="boardsesh-")
    print(f"Cloning boardsesh (sparse) into {tmp}…")
    subprocess.run(["git", "clone", "--depth", "1", "--filter=blob:none",
                    "--sparse", REPO, tmp], check=True)
    subprocess.run(["git", "-C", tmp, "sparse-checkout", "set", IMG_SUBPATH],
                   check=True)
    return tmp


def make_imageset(dest_dir, name, src_png):
    """Create <dest_dir>/<name>.imageset with the png + Contents.json."""
    iset = os.path.join(dest_dir, f"{name}.imageset")
    os.makedirs(iset, exist_ok=True)
    filename = f"{name}.png"
    shutil.copyfile(src_png, os.path.join(iset, filename))
    write_json(os.path.join(iset, "Contents.json"), imageset_contents(filename))


def make_namespace(path):
    os.makedirs(path, exist_ok=True)
    write_json(os.path.join(path, "Contents.json"), NAMESPACE_CONTENTS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", help="path to a boardsesh checkout (else sparse-clones)")
    ap.add_argument("--assets", default=os.path.join(
        os.path.dirname(__file__), "..", "MoonBoardLED", "Assets.xcassets"))
    args = ap.parse_args()

    cloned = None
    src_root = args.src
    if not src_root:
        cloned = src_root = sparse_clone()

    img_dir = os.path.join(src_root, IMG_SUBPATH)
    if not os.path.isdir(img_dir):
        sys.exit(f"Not found: {img_dir} (is --src a boardsesh checkout?)")

    boards = os.path.abspath(os.path.join(args.assets, "Boards"))
    make_namespace(boards)

    count = 0
    for bg in BACKGROUNDS:
        src = os.path.join(img_dir, bg)
        if os.path.isfile(src):
            make_imageset(boards, os.path.splitext(bg)[0], src)
            count += 1

    for folder in LAYOUT_FOLDERS:
        src_folder = os.path.join(img_dir, folder)
        if not os.path.isdir(src_folder):
            print(f"  (skip missing {folder})")
            continue
        ns = os.path.join(boards, folder)
        make_namespace(ns)
        for fn in sorted(os.listdir(src_folder)):
            if fn.endswith(".png"):
                make_imageset(ns, os.path.splitext(fn)[0], os.path.join(src_folder, fn))
                count += 1

    if cloned:
        shutil.rmtree(cloned, ignore_errors=True)

    print(f"\nImported {count} imagesets -> {boards}")


if __name__ == "__main__":
    main()
