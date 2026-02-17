#!/home/npepin/Projects/CityLife/.venv/bin/python
"""One-time OBJ -> isometric PNG sprite generator.

Usage:
  /home/npepin/Projects/CityLife/.venv/bin/python tools/render_isometric_sprites.py \
    --input assets/assets-OBJ \
    --output assets/obj-sprites \
    --size 256
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
import trimesh
import pyrender
from PIL import Image, ImageChops, ImageFilter


def isometric_matrix() -> np.ndarray:
    # Isometric view: rotate around Z by -45°, then around X by 35.264°
    rz = trimesh.transformations.rotation_matrix(
        math.radians(-45.0), [0, 0, 1]
    )
    rx = trimesh.transformations.rotation_matrix(
        math.radians(35.264), [1, 0, 0]
    )
    return rx @ rz


def normalize_scene(mesh: trimesh.Trimesh) -> trimesh.Trimesh:
    # Center and scale mesh to unit size
    mesh = mesh.copy()
    mesh.apply_translation(-mesh.bounds.mean(axis=0))
    extents = mesh.extents
    scale = 1.0 / max(extents) if max(extents) > 0 else 1.0
    mesh.apply_scale(scale)
    return mesh


def render_isometric(mesh: trimesh.Trimesh, size: int, color_rgba=(255, 255, 255, 255)) -> Image.Image:
    mesh = normalize_scene(mesh)
    mesh.apply_transform(isometric_matrix())

    # override colors for a clean, solid look
    rgba = np.array(color_rgba, dtype=np.uint8)
    mesh.visual = trimesh.visual.ColorVisuals(mesh, face_colors=rgba)

    scene = pyrender.Scene(bg_color=[0, 0, 0, 0], ambient_light=[0.22, 0.22, 0.22])

    material = pyrender.MetallicRoughnessMaterial(
        metallicFactor=0.0, roughnessFactor=0.9, baseColorFactor=(1.0, 1.0, 1.0, 1.0)
    )
    pm = pyrender.Mesh.from_trimesh(mesh, material=material, smooth=True)
    scene.add(pm)

    extent = max(mesh.extents)
    cam = pyrender.OrthographicCamera(xmag=extent, ymag=extent)
    cam_pose = np.eye(4)
    cam_pose[:3, 3] = [0, 0, 2.8]
    scene.add(cam, pose=cam_pose)

    # Lighting for readable solids
    light_main = pyrender.DirectionalLight(color=np.ones(3), intensity=3.2)
    light_fill = pyrender.DirectionalLight(color=np.ones(3), intensity=1.4)
    light_back = pyrender.DirectionalLight(color=np.ones(3), intensity=0.6)
    scene.add(light_main, pose=trimesh.transformations.rotation_matrix(math.radians(35), [1, 0, 0]))
    scene.add(light_fill, pose=trimesh.transformations.rotation_matrix(math.radians(-35), [1, 0, 0]))
    scene.add(light_back, pose=trimesh.transformations.rotation_matrix(math.radians(140), [0, 1, 0]))

    r = pyrender.OffscreenRenderer(viewport_width=size, viewport_height=size)
    flags = pyrender.RenderFlags.RGBA | pyrender.RenderFlags.FLAT
    color, _ = r.render(scene, flags=flags)
    r.delete()

    return Image.fromarray(color, mode="RGBA")


def add_outline(img: Image.Image, color=(20, 20, 30, 255), thickness: int = 2) -> Image.Image:
    alpha = img.split()[-1]
    expanded = alpha.filter(ImageFilter.MaxFilter(thickness * 2 + 1))
    outline = ImageChops.subtract(expanded, alpha)
    outline_img = Image.new("RGBA", img.size, color)
    img = Image.alpha_composite(outline_img, img)
    img.putalpha(ImageChops.lighter(alpha, outline))
    return img


def crop_and_pack(img: Image.Image, size: int, pad: int = 16) -> Image.Image:
    # Crop to alpha content
    alpha = img.split()[-1]
    bbox = alpha.getbbox()
    if not bbox:
        return img.resize((size, size), resample=Image.LANCZOS)

    cropped = img.crop(bbox)
    cw, ch = cropped.size
    target = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    scale = min((size - 2 * pad) / max(1, cw), (size - 2 * pad) / max(1, ch))
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = cropped.resize((nw, nh), resample=Image.LANCZOS)
    x = (size - nw) // 2
    y = size - nh - pad
    target.paste(resized, (x, y), resized)
    return target


def render_obj(input_path: Path, output_path: Path, size: int, color_rgba) -> None:
    mesh = trimesh.load(input_path, force="mesh")
    if isinstance(mesh, trimesh.Scene):
        mesh = trimesh.util.concatenate(tuple(mesh.dump()))
    render_size = size * 4
    img = render_isometric(mesh, render_size, color_rgba=color_rgba)
    img = add_outline(img, color=(20, 20, 30, 255), thickness=2)
    img = crop_and_pack(img, size=size, pad=int(size * 0.12))
    img.save(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Render OBJ files to isometric PNG sprites.")
    parser.add_argument("--input", default="assets/assets-OBJ", help="Input folder with OBJ files")
    parser.add_argument("--output", default="assets/obj-sprites", help="Output folder for PNG sprites")
    parser.add_argument("--size", type=int, default=256, help="Output image size (square) in pixels")
    args = parser.parse_args()

    in_dir = Path(args.input)
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    obj_files = sorted(in_dir.glob("*.obj"))
    if not obj_files:
        raise SystemExit(f"No .obj files found in {in_dir}")

    palette = {
        "House": (157, 183, 255, 255),
        "University": (213, 178, 255, 255),
        "Office": (139, 255, 210, 255),
        "Factory": (255, 154, 170, 255),
        "Hospital": (159, 238, 255, 255),
        "Mall": (255, 210, 122, 255),
        "Tree1": (120, 200, 120, 255),
        "Tree2": (120, 200, 120, 255),
        "Tree3": (120, 200, 120, 255),
        "Tree4": (120, 200, 120, 255),
    }

    for obj in obj_files:
        out_png = out_dir / (obj.stem + ".png")
        print(f"Rendering {obj.name} -> {out_png}")
        color = palette.get(obj.stem, (220, 220, 220, 255))
        render_obj(obj, out_png, args.size, color)


if __name__ == "__main__":
    main()
