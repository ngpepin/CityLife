#!/usr/bin/env python3
"""Generate directional sprite variants (N/E/S/W) from base sprites.

This creates assets in assets/glb-sprites/dir/ for renderer direction mapping.
Current source art only includes one canonical view, so this script uses:
  - S: original
  - E: original
  - W: mirrored
  - N: mirrored + slight darken
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps


def generate_one(src: Path, out_dir: Path) -> None:
    base = Image.open(src).convert("RGBA")
    name = src.stem

    east = base
    west = ImageOps.mirror(base)
    south = base
    north = ImageEnhance.Brightness(ImageOps.mirror(base)).enhance(0.94)

    east.save(out_dir / f"{name}_e.png")
    west.save(out_dir / f"{name}_w.png")
    south.save(out_dir / f"{name}_s.png")
    north.save(out_dir / f"{name}_n.png")


def main() -> None:
    src_dir = Path("assets/glb-sprites")
    out_dir = src_dir / "dir"
    out_dir.mkdir(parents=True, exist_ok=True)

    names = ["house", "university", "office", "factory", "hospital", "mall", "park"]
    for name in names:
        src = src_dir / f"{name}.png"
        if not src.exists():
            print(f"skip missing: {src}")
            continue
        generate_one(src, out_dir)
        print(f"wrote dir sprites: {name}")


if __name__ == "__main__":
    main()
