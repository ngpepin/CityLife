#!/home/npepin/Projects/CityLife/.venv/bin/python
"""One-time GLB -> isometric PNG sprite generator.

Usage:
  /home/npepin/Projects/CityLife/.venv/bin/python tools/render_glb_isometric_sprites.py \
    --input assets/GLB/in-good-order \
    --output assets/glb-sprites \
    --size 256
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
import trimesh
import pyrender
from PIL import Image


def isometric_matrix() -> np.ndarray:
    rz = trimesh.transformations.rotation_matrix(
        math.radians(-45.0), [0, 0, 1]
    )
    rx = trimesh.transformations.rotation_matrix(
        math.radians(35.264), [1, 0, 0]
    )
    return rx @ rz


def scene_bounds(scene: trimesh.Scene):
    if not scene.geometry:
        return None
    bounds = np.array([geom.bounds for geom in scene.geometry.values()])
    mins = bounds[:, 0, :].min(axis=0)
    maxs = bounds[:, 1, :].max(axis=0)
    return np.stack([mins, maxs], axis=0)


def normalize_scene(scene: trimesh.Scene) -> trimesh.Scene:
    bounds = scene_bounds(scene)
    if bounds is None:
        return scene
    center = bounds.mean(axis=0)
    extents = bounds[1] - bounds[0]
    scale = 1.0 / max(extents) if max(extents) > 0 else 1.0

    transform = np.eye(4)
    transform[:3, 3] = -center
    scene.apply_transform(transform)
    scene.apply_scale(scale)
    return scene


def render_isometric(scene: trimesh.Scene, size: int) -> Image.Image:
    scene = normalize_scene(scene)
    scene.apply_transform(isometric_matrix())

    pyr_scene = pyrender.Scene(bg_color=[0, 0, 0, 0], ambient_light=[0.35, 0.35, 0.35])

    for geom in scene.geometry.values():
        try:
            pm = pyrender.Mesh.from_trimesh(geom, smooth=True)
            pyr_scene.add(pm)
        except Exception:
            pass

    bounds = scene_bounds(scene)
    extent = max((bounds[1] - bounds[0])) if bounds is not None else 1.0
    cam = pyrender.OrthographicCamera(xmag=extent, ymag=extent)
    cam_pose = np.eye(4)
    cam_pose[:3, 3] = [0, 0, 2.8]
    pyr_scene.add(cam, pose=cam_pose)

    light_main = pyrender.DirectionalLight(color=np.ones(3), intensity=2.5)
    light_fill = pyrender.DirectionalLight(color=np.ones(3), intensity=1.0)
    light_back = pyrender.DirectionalLight(color=np.ones(3), intensity=0.6)
    pyr_scene.add(light_main, pose=trimesh.transformations.rotation_matrix(math.radians(35), [1, 0, 0]))
    pyr_scene.add(light_fill, pose=trimesh.transformations.rotation_matrix(math.radians(-35), [1, 0, 0]))
    pyr_scene.add(light_back, pose=trimesh.transformations.rotation_matrix(math.radians(140), [0, 1, 0]))

    r = pyrender.OffscreenRenderer(viewport_width=size, viewport_height=size)
    flags = pyrender.RenderFlags.RGBA | pyrender.RenderFlags.SKIP_CULL_FACES
    color, _ = r.render(pyr_scene, flags=flags)
    r.delete()

    img = Image.fromarray(color, mode="RGBA")
    # Key out background by sampling corners (handles non-black backgrounds)
    arr = np.array(img)
    h, w = arr.shape[0], arr.shape[1]
    samples = np.vstack([
        arr[0, 0], arr[0, w - 1], arr[h - 1, 0], arr[h - 1, w - 1],
        arr[0, w // 2], arr[h - 1, w // 2], arr[h // 2, 0], arr[h // 2, w - 1],
    ])
    bg = samples[:, :3].mean(axis=0)
    diff = np.linalg.norm(arr[:, :, :3] - bg, axis=2)
    mask = diff < 8.0
    arr[mask, 3] = 0
    return Image.fromarray(arr, mode="RGBA")


def crop_and_pack(img: Image.Image, size: int, pad: int = 16) -> Image.Image:
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


def render_glb(input_path: Path, output_path: Path, size: int) -> None:
    scene = trimesh.load(input_path, force="scene")
    if isinstance(scene, trimesh.Trimesh):
        scene = trimesh.Scene(scene)
    img = render_isometric(scene, size * 4)
    img = crop_and_pack(img, size=size, pad=int(size * 0.12))
    img.save(output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Render GLB files to isometric PNG sprites.")
    parser.add_argument("--input", default="assets/GLB/in-good-order", help="Input folder with subfolders")
    parser.add_argument("--output", default="assets/glb-sprites", help="Output folder for PNG sprites")
    parser.add_argument("--size", type=int, default=256, help="Output image size (square) in pixels")
    args = parser.parse_args()

    in_dir = Path(args.input)
    out_dir = Path(args.output)
    out_dir.mkdir(parents=True, exist_ok=True)

    folders = [p for p in in_dir.iterdir() if p.is_dir()]
    if not folders:
        raise SystemExit(f"No subfolders found in {in_dir}")

    for folder in sorted(folders):
        glb_files = sorted(folder.glob("*.glb"))
        if not glb_files:
            continue
        glb = glb_files[0]
        out_png = out_dir / f"{folder.name}.png"
        print(f"Rendering {glb} -> {out_png}")
        render_glb(glb, out_png, args.size)


if __name__ == "__main__":
    main()
