# Building anchor generator.
#
# Scans public/art/buildings/*.png and emits src/renderer/render/buildingAnchors.generated.ts
# with, per asset, the data needed to seat an isometric building sprite precisely on its tile.
#
# Why this exists: the AI-generated building art varies in canvas size and the in-image
# position/width of the drawn ground footprint (some have trees / signboards sticking out).
# A single global formula cannot align them, so we measure each image's footprint from pixels.
#
# Metrics (all fractions of the image, 0..1):
#   anchorYFrac        = lowest opaque row / (h-1)
#                        -> the front-bottom vertex of the drawn ground diamond sits at the
#                           lowest opaque pixel (nothing opaque renders below it -> depth-safe).
#   footprintWidthFrac = widest opaque row span in the LOWER HALF / w
#                        -> the ground diamond is widest near its vertical middle-low; trees and
#                           roofs live in the upper half and are excluded. Floored to avoid
#                           a near-zero width blowing up the render scale.
#   anchorXFrac        = horizontal MIDPOINT of that widest row / (w-1)
#                        -> kept geometrically consistent with footprintWidthFrac (same row),
#                           so the anchor sits at the centre of the measured footprint, not the
#                           mean of all opaque columns (which a one-sided tree would bias).
#
# Constants:
#   ALPHA_THRESHOLD = 16  -> treat alpha>16 as opaque (ignores faint anti-aliasing fringes).
#   BOTTOM_BAND, LOWER_HALF -> see metric notes above.
#   MIN_FOOTPRINT_FRAC = 0.10 -> floor so a thin base cannot produce an exploding scale.
#
# Output is checked into git (deterministic). Re-run this script whenever building art changes:
#   python scripts/gen_building_anchors.py
#
# ASCII-only console output (Windows GBK code page cannot print emoji).
from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    from PIL import Image
    import numpy as np
except ImportError:
    sys.stderr.write("[gen_anchors] ERROR: requires Pillow + numpy. pip install Pillow numpy\n")
    sys.exit(1)

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
BUILDINGS_DIR = REPO_ROOT / "public" / "art" / "buildings"
OUT_FILE = REPO_ROOT / "src" / "renderer" / "render" / "buildingAnchors.generated.ts"

ALPHA_THRESHOLD = 16
MIN_FOOTPRINT_FRAC = 0.10
KEY_RE = re.compile(r"^bld_[a-z0-9_]+$")  # whitelist: prevents odd filenames breaking generated TS

FALLBACK = {"anchorXFrac": 0.5, "anchorYFrac": 1.0, "footprintWidthFrac": 1.0}


def compute_anchors(img_path: Path) -> dict:
    img = Image.open(img_path)
    if img.mode != "RGBA":
        # RGB/P/L have no real transparency -> cannot locate footprint; use fallback.
        if "A" not in img.getbands():
            print("[gen_anchors] WARNING: %s has no alpha channel -> fallback" % img_path.name)
            return dict(FALLBACK)
        img = img.convert("RGBA")

    arr = np.asarray(img)
    h, w = arr.shape[:2]
    if h < 2 or w < 2:
        print("[gen_anchors] WARNING: %s too small -> fallback" % img_path.name)
        return dict(FALLBACK)

    opaque = arr[:, :, 3] > ALPHA_THRESHOLD  # (h, w) bool

    opaque_rows = np.where(opaque.any(axis=1))[0]
    if opaque_rows.size == 0:
        print("[gen_anchors] WARNING: %s fully transparent -> fallback" % img_path.name)
        return dict(FALLBACK)

    anchor_y_frac = float(opaque_rows[-1]) / (h - 1)

    # Footprint width = widest opaque row span within the lower half (rows h//2..h).
    lower_start = h // 2
    best_span = 0
    best_mid = None  # column midpoint of the widest row
    for r in range(lower_start, h):
        cols = np.where(opaque[r])[0]
        if cols.size == 0:
            continue
        left = int(cols[0])
        right = int(cols[-1])
        span = right - left + 1
        if span > best_span:
            best_span = span
            best_mid = (left + right) / 2.0

    if best_span == 0 or best_mid is None:
        # Lower half empty (tiny base high up): fall back to the full opaque extent.
        all_cols = np.where(opaque.any(axis=0))[0]
        left = int(all_cols[0])
        right = int(all_cols[-1])
        best_span = right - left + 1
        best_mid = (left + right) / 2.0

    footprint_width_frac = max(MIN_FOOTPRINT_FRAC, float(best_span) / w)
    anchor_x_frac = float(best_mid) / (w - 1)

    return {
        "anchorXFrac": round(anchor_x_frac, 4),
        "anchorYFrac": round(anchor_y_frac, 4),
        "footprintWidthFrac": round(footprint_width_frac, 4),
    }


def main() -> None:
    pngs = sorted(BUILDINGS_DIR.glob("*.png"))
    if not pngs:
        print("[gen_anchors] no PNG files under %s" % BUILDINGS_DIR)
        sys.exit(0)

    lines = []
    for png in pngs:
        key = png.stem
        if not KEY_RE.match(key):
            print("[gen_anchors] WARNING: skipping unexpected filename '%s' (not ^bld_[a-z0-9_]+$)" % png.name)
            continue
        d = compute_anchors(png)
        lines.append(
            '  "%s": { anchorXFrac: %s, anchorYFrac: %s, footprintWidthFrac: %s },'
            % (key, d["anchorXFrac"], d["anchorYFrac"], d["footprintWidthFrac"])
        )
        print("[gen_anchors] %-22s anchorX=%.4f anchorY=%.4f footW=%.4f"
              % (key, d["anchorXFrac"], d["anchorYFrac"], d["footprintWidthFrac"]))

    if lines:
        lines[-1] = lines[-1].rstrip(",")

    ts = "\n".join(
        [
            "// AUTO-GENERATED by scripts/gen_building_anchors.py, do not edit by hand.",
            "// Re-run that script whenever building art under public/art/buildings/ changes.",
            "",
            "export const BUILDING_ANCHORS: Record<string, { anchorXFrac: number; anchorYFrac: number; footprintWidthFrac: number }> = {",
        ]
        + lines
        + ["};", ""]
    )
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(ts, encoding="utf-8")
    print("[gen_anchors] wrote %s (%d entries)" % (OUT_FILE, len(lines)))


if __name__ == "__main__":
    main()
