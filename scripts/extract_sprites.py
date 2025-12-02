"""
Extract selected jackpot sprites from the texture atlases into individual files.

Uses the frame data stored in the TexturePacker-style plist files together
with ImageMagick's ``convert`` tool (which is available in the environment).
Only the sprites used by the jackpot HTML/CSS animation are exported.
"""

from __future__ import annotations

import plistlib
import re
import shutil
import subprocess
from pathlib import Path
from typing import Iterable, Tuple


ROOT = Path(__file__).resolve().parent.parent


def parse_frame(rect: str) -> tuple[int, int, int, int]:
    """Parse a "{{x,y},{w,h}}" rect string into numeric parts."""
    numbers = [int(v) for v in re.findall(r"-?\d+", rect)]
    if len(numbers) != 4:
        raise ValueError(f"Unexpected rect format: {rect}")
    return numbers[0], numbers[1], numbers[2], numbers[3]


def parse_size(val: str) -> Tuple[int, int]:
    numbers = [int(v) for v in re.findall(r"-?\d+", val)]
    if len(numbers) != 2:
        raise ValueError(f"Unexpected size format: {val}")
    return numbers[0], numbers[1]


def parse_rect(rect: str) -> tuple[int, int, int, int]:
    numbers = [int(v) for v in re.findall(r"-?\d+", rect)]
    if len(numbers) != 4:
        raise ValueError(f"Unexpected rect format: {rect}")
    return numbers[0], numbers[1], numbers[2], numbers[3]


def detect_sheet_path(plist_path: Path, fallback: Path | None = None) -> Path:
    atlas = plistlib.loads(plist_path.read_bytes())
    meta = atlas.get("metadata", {})
    fname = meta.get("textureFileName") or meta.get("realTextureFileName")
    candidates = []
    if fname:
        sheet_path = plist_path.parent / fname
        candidates.append(sheet_path)
        # If metadata points to jpg but a png exists (common after converting atlases),
        # prefer the png.
        if sheet_path.suffix.lower() in {".jpg", ".jpeg"}:
            candidates.append(sheet_path.with_suffix(".png"))
    if fallback:
        candidates.append(fallback)
    # Try common extensions if nothing else resolves.
    if not candidates:
        stem = plist_path.stem
        for ext in (".png", ".jpg", ".jpeg"):
            candidates.append(plist_path.parent / f"{stem}{ext}")
    for c in candidates:
        if c.exists():
            return c
    raise FileNotFoundError(f"No sheet image found for {plist_path}")


def export_sprites(
    plist_path: Path,
    names: Iterable[str],
    out_dir: Path,
    sheet: Path | None = None,
    alias: dict[str, str] | None = None,
) -> None:
    atlas = plistlib.loads(plist_path.read_bytes())
    sheet_path = detect_sheet_path(plist_path, sheet)
    frames = atlas["frames"]
    out_dir.mkdir(parents=True, exist_ok=True)

    for name in names:
        source_name = alias.get(name, name) if alias else name
        meta = frames[source_name]
        x, y, w, h = parse_frame(meta["frame"])
        rotated = bool(meta.get("rotated"))
        src_w, src_h = parse_size(meta.get("sourceSize", "{%d,%d}" % (w, h)))
        color_x, color_y, color_w, color_h = parse_rect(
            meta.get("sourceColorRect", "{{0,0},{%d,%d}}" % (w, h))
        )
        target = out_dir / name
        out_dir.mkdir(parents=True, exist_ok=True)

        # Handle rotation as TexturePacker/Cocos: usually rotated frames have width/height
        # swapped and need a -90° (clockwise) to get upright. Some atlases keep matching
        # sizes even when flagging rotation; in that case we skip the rotation to avoid
        # mirroring.
        if rotated:
            crop_w, crop_h = h, w  # stored rotated 90°, width/height swapped
            rotate_angle = -90     # rotate back counterclockwise to upright
        else:
            crop_w, crop_h = w, h
            rotate_angle = 0

        cmd = [
            "convert",
            "-size",
            f"{src_w}x{src_h}",
            "xc:none",
            "(",
            str(sheet_path),
            "-crop",
            f"{crop_w}x{crop_h}+{x}+{y}",
            "+repage",
        ]
        if rotate_angle:
            cmd.extend(["-rotate", str(rotate_angle)])
        if target.suffix.lower() == ".png" and sheet_path.suffix.lower() in {".jpg", ".jpeg"}:
            cmd.extend(["-alpha", "on", "-transparent", "black"])
        cmd += [
            ")",
            "-geometry",
            f"+{color_x}+{color_y}",
            "-compose",
            "over",
            "-composite",
            str(target),
        ]
        subprocess.run(cmd, check=True)


def main() -> None:
    assets_root = ROOT / "res/cocos/cocosstudio/_bitmaps"
    assets_root_png = ROOT / "res/exportJosn/_bitmaps"

    export_sprites(
        plist_path=assets_root / "game_jackpot1.plist",
        names=[
            "display_bg_univerzal.png",
            "display_bg_gold.png",
            "display_bg_silver.png",
            "display_bg_bronze.png",
            "title_J.png",
            "title_J_glow.png",
            "title_A.png",
            "title_A_glow.png",
            "title_C.png",
            "title_C_glow.png",
            "title_K.png",
            "title_K_glow.png",
            "title_P.png",
            "title_P_glow.png",
            "title_O.png",
            "title_O_glow.png",
            "title_T.png",
            "title_T_glow.png",
        ],
        out_dir=ROOT / "web/assets",
    )

    export_sprites(
        plist_path=assets_root_png / "game_jackpot2.plist",
        sheet=assets_root_png / "game_jackpot2.png",
        names=[
            "bg_glow.png",
            "bg_shine.png",
            "bg_sparkles_B.png",
            "bg_sparkles_L.png",
            "bg_sparkles_RB.png",
            "bg_sparkles_RT.png",
        ],
        out_dir=ROOT / "web/assets",
    )

    # Reuse the standalone glow texture in the web assets.
    glow_src = assets_root / "glow.png"
    glow_dst = ROOT / "web/assets/glow.png"
    glow_dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(glow_src, glow_dst)


if __name__ == "__main__":
    main()
