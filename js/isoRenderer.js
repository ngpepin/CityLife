import { clamp, lerp } from "./utils.js";
import { CONFIG } from "./config.js";

export class IsoRenderer {
  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = state;
    this.iconCache = new Map();

    this.camera = {
      x: 0,
      y: 0,
      zoom: 1.0,
      rot: 0, // 0..3
    };

    this.dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.origin = { x: 0, y: 0 };
    this.resize(false);

    this.hoverTile = null;
  }

  centerOnWorld() {
    const W = this.state.gridW;
    const H = this.state.gridH;
    const cx = (W - 1) / 2;
    const cy = (H - 1) / 2;
    const rc = this.rotCoord(cx, cy);
    const tw = CONFIG.tileW;
    const th = CONFIG.tileH;
    const sx = (rc.x - rc.y) * (tw / 2);
    const sy = (rc.x + rc.y) * (th / 2);
    this.camera.x = -sx;
    this.camera.y = -sy;
  }

  resize(preserveCamera = true) {
    const oldOrigin = preserveCamera ? this.getOrigin() : null;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.origin = {
      x: this.canvas.clientWidth / 2,
      y: this.canvas.clientHeight / 2 - 60,
    };

    if (preserveCamera && oldOrigin) {
      const newOrigin = this.getOrigin();
      const z = this.camera.zoom || 1;
      this.camera.x += (oldOrigin.x - newOrigin.x) / z;
      this.camera.y += (oldOrigin.y - newOrigin.y) / z;
    }
  }

  setHoverTile(tile) {
    this.hoverTile = tile;
  }

  // Apply rotation to grid coords (x,y) around origin (0,0) using grid bounds
  rotCoord(x, y) {
    const W = this.state.gridW,
      H = this.state.gridH;
    const r = ((this.camera.rot % 4) + 4) % 4;
    if (r === 0) return { x, y };
    if (r === 1) return { x: H - 1 - y, y: x };
    if (r === 2) return { x: W - 1 - x, y: H - 1 - y };
    return { x: y, y: W - 1 - x }; // r === 3
  }

  invRotCoord(x, y) {
    // inverse rotation
    const W = this.state.gridW,
      H = this.state.gridH;
    const r = ((this.camera.rot % 4) + 4) % 4;
    if (r === 0) return { x, y };
    if (r === 1) return { x: y, y: H - 1 - x };
    if (r === 2) return { x: W - 1 - x, y: H - 1 - y };
    return { x: W - 1 - y, y: x }; // r === 3
  }

  gridToScreen(x, y) {
    // rotated coords for drawing
    const rc = this.rotCoord(x, y);
    const tw = CONFIG.tileW,
      th = CONFIG.tileH;
    const sx = (rc.x - rc.y) * (tw / 2);
    const sy = (rc.x + rc.y) * (th / 2);
    const origin = this.getOrigin();
    const z = this.camera.zoom;
    return {
      x: origin.x + (sx + this.camera.x) * z,
      y: origin.y + (sy + this.camera.y) * z,
    };
  }

  screenToGrid(px, py) {
    // Convert screen->world iso -> rotated grid -> inverse rotate
    const origin = this.getOrigin();
    const z = this.camera.zoom;
    const wx = (px - origin.x) / z - this.camera.x;
    const wy = (py - origin.y) / z - this.camera.y;

    const tw = CONFIG.tileW,
      th = CONFIG.tileH;
    // derived from:
    // sx=(x-y)*tw/2 ; sy=(x+y)*th/2
    // => x = sy/th + sx/tw ; y = sy/th - sx/tw
    const rx = (wy / (th / 2) + wx / (tw / 2)) / 2;
    const ry = (wy / (th / 2) - wx / (tw / 2)) / 2;

    const gx = Math.floor(rx + 0.00001);
    const gy = Math.floor(ry + 0.00001);
    const inv = this.invRotCoord(gx, gy);
    return inv;
  }

  getOrigin() {
    return this.origin;
  }

  draw() {
    const ctx = this.ctx;
    const W = this.state.gridW,
      H = this.state.gridH;

    // Background "sky glow"
    ctx.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
    this.drawBackground(ctx);

    // Draw ground tiles, roads, then buildings with depth sorting
    const drawItems = [];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        drawItems.push({ kind: "tile", x, y, z: x + y });
        const cell = this.state.grid[y][x];
        if (cell.road) drawItems.push({ kind: "road", x, y, z: x + y + 0.01 });
        if (cell.buildingId) {
          const b = this.state.buildings.get(cell.buildingId);
          if (b && b.x === x && b.y === y) {
            drawItems.push({ kind: "building", x, y, z: x + y + 0.2, id: b.id });
          }
        }
      }
    }

    drawItems.sort((a, b) => a.z - b.z);

    for (const it of drawItems) {
      if (it.kind === "tile") this.drawTile(it.x, it.y);
      else if (it.kind === "road") this.drawRoad(it.x, it.y);
      else this.drawBuilding(it.id);
    }

    this.drawHoverAndSelection(ctx);
    this.drawVignette(ctx);
  }

  drawBackground(ctx) {
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;

    const g = ctx.createRadialGradient(w * 0.35, h * 0.2, 30, w * 0.35, h * 0.2, Math.max(w, h));
    g.addColorStop(0, "rgba(120,140,255,0.22)");
    g.addColorStop(0.35, "rgba(40,70,160,0.10)");
    g.addColorStop(1, "rgba(0,0,0,0.00)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // faint stars
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "white";
    for (let i = 0; i < 70; i++) {
      const x = (Math.sin(i * 999.1) + 1) * 0.5 * w;
      const y = (Math.cos(i * 421.7) + 1) * 0.5 * h * 0.6;
      ctx.fillRect(x, y, 1, 1);
    }
    ctx.globalAlpha = 1;
  }

  drawTile(x, y) {
    const ctx = this.ctx;
    const p = this.gridToScreen(x, y);
    const tw = CONFIG.tileW * this.camera.zoom;
    const th = CONFIG.tileH * this.camera.zoom;

    // subtle checker-ish ground with gradient
    const base = (x + y) % 2 === 0 ? 0.05 : 0.03;
    const fill = `rgba(255,255,255,${base})`;
    const edge = "rgba(255,255,255,0.06)";

    this.isoDiamond(ctx, p.x, p.y, tw, th, fill, edge);

    // faint "height haze"
    ctx.globalAlpha = 0.08;
    ctx.strokeStyle = "rgba(120,140,255,0.55)";
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + tw * 0.5, p.y + th * 0.5);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawRoad(x, y) {
    const ctx = this.ctx;
    const p = this.gridToScreen(x, y);
    const tw = CONFIG.tileW * this.camera.zoom;
    const th = CONFIG.tileH * this.camera.zoom;

    const A = { x: p.x, y: p.y - th / 2 };
    const B = { x: p.x + tw / 2, y: p.y };
    const C = { x: p.x, y: p.y + th / 2 };
    const D = { x: p.x - tw / 2, y: p.y };

    // asphalt fill
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.lineTo(C.x, C.y);
    ctx.lineTo(D.x, D.y);
    ctx.closePath();

    const grad = ctx.createLinearGradient(D.x, A.y, B.x, C.y);
    grad.addColorStop(0, "rgba(30,34,44,0.98)");
    grad.addColorStop(1, "rgba(90,100,130,0.75)");
    ctx.fillStyle = grad;
    ctx.fill();

    // edge stroke
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // outer glow to lift roads from tiles
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = "rgba(120,160,255,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // subtle inset highlight
    ctx.globalAlpha = 0.32;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y + th * 0.1);
    ctx.lineTo(B.x - tw * 0.1, B.y);
    ctx.lineTo(C.x, C.y - th * 0.1);
    ctx.lineTo(D.x + tw * 0.1, D.y);
    ctx.closePath();
    ctx.strokeStyle = "rgba(120,140,255,0.28)";
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Connectivity-driven markings (connector ticks):
    // - dead-ends: one short connector tick
    // - straight/corner: ticks toward connected edges
    // - intersections (3/4): no markings (keeps it clean)
    const mask = this.roadMask(x, y);
    const dirs = [];
    if (mask.n) dirs.push("n");
    if (mask.e) dirs.push("e");
    if (mask.s) dirs.push("s");
    if (mask.w) dirs.push("w");

    if (dirs.length >= 1 && dirs.length <= 2) {
      ctx.save();
      ctx.globalAlpha = 0.32;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);

      const cx = p.x,
        cy = p.y;

      const tick = (tx, ty) => {
        const k1 = 0.08,
          k2 = 0.26;
        ctx.beginPath();
        ctx.moveTo(cx + (tx - cx) * k1, cy + (ty - cy) * k1);
        ctx.lineTo(cx + (tx - cx) * k2, cy + (ty - cy) * k2);
        ctx.stroke();
      };

      // edge midpoints
      const midN = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
      const midE = { x: (B.x + C.x) / 2, y: (B.y + C.y) / 2 };
      const midS = { x: (C.x + D.x) / 2, y: (C.y + D.y) / 2 };
      const midW = { x: (D.x + A.x) / 2, y: (D.y + A.y) / 2 };

      for (const d of dirs) {
        if (d === "n") tick(midN.x, midN.y);
        if (d === "e") tick(midE.x, midE.y);
        if (d === "s") tick(midS.x, midS.y);
        if (d === "w") tick(midW.x, midW.y);
      }

      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.restore();
  }

  roadMask(x, y) {
    const W = this.state.gridW,
      H = this.state.gridH;
    const isRoad = (xx, yy) => xx >= 0 && yy >= 0 && xx < W && yy < H && this.state.grid[yy][xx].road;

    return {
      n: isRoad(x, y - 1),
      s: isRoad(x, y + 1),
      w: isRoad(x - 1, y),
      e: isRoad(x + 1, y),
    };
  }

  drawBuilding(id) {
    const ctx = this.ctx;
    const b = this.state.buildings.get(id);
    if (!b) return;

    const p = this.gridToScreen(b.x, b.y);
    const tw = CONFIG.tileW * this.camera.zoom;
    const th = CONFIG.tileH * this.camera.zoom;

    // determine "height" by type
    const h =
      b.type === "house"
        ? 0.55
        : b.type === "park"
        ? 0.2
        : b.type === "mall"
        ? 0.6
        : b.type === "school"
        ? 0.65
        : b.type === "hospital"
        ? 0.75
        : b.type === "office"
        ? 0.95
        : b.type === "factory"
        ? 0.85
        : 0.6;

    const colors = this.state.getBuildingColors(b.type);
    const active = b.active;

    // soft shadow
    ctx.save();
    ctx.globalAlpha = active ? 0.32 : 0.2;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + th * 0.22, tw * 0.26, th * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // isometric prism
    this.isoPrism(ctx, p.x, p.y, tw, th, h * th * 1.85, colors, active);

    // top icon (SVG)
    const iconSize = Math.max(18, Math.floor(22 * this.camera.zoom));
    try {
      const iconImg = this.getIconImage(b.type, colors.top, active);
      const ix = p.x - iconSize / 2;
      const iy = p.y - h * th * 1.05 - iconSize / 2;
      if (iconImg && iconImg.complete) {
        ctx.save();
        ctx.globalAlpha = active ? 0.95 : 0.55;
        ctx.drawImage(iconImg, ix, iy, iconSize, iconSize);
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = active ? 0.6 : 0.35;
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath();
        ctx.arc(p.x, p.y - h * th * 1.05, iconSize * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } catch {
      ctx.save();
      ctx.globalAlpha = active ? 0.6 : 0.35;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.arc(p.x, p.y - h * th * 1.05, iconSize * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // inactive indicator
    if (!active) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.font = `${Math.max(10, Math.floor(12 * this.camera.zoom))}px ui-sans-serif`;
      ctx.fillStyle = "rgba(255,180,120,0.95)";
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 3;
      const txt = "Needs road";
      ctx.strokeText(txt, p.x, p.y + th * 0.52);
      ctx.fillText(txt, p.x, p.y + th * 0.52);
      ctx.restore();
    }
  }

  drawHoverAndSelection(ctx) {
    const tw = CONFIG.tileW * this.camera.zoom;
    const th = CONFIG.tileH * this.camera.zoom;

    if (this.hoverTile) {
      const p = this.gridToScreen(this.hoverTile.x, this.hoverTile.y);
      ctx.save();
      ctx.globalAlpha = 0.22;
      this.isoDiamond(ctx, p.x, p.y, tw, th, "rgba(120,140,255,0.28)", "rgba(120,140,255,0.55)");
      ctx.restore();
    }

    const sel = this.state.selected;
    if (sel && sel.kind === "building") {
      const b = this.state.buildings.get(sel.id);
      if (b) {
        const p = this.gridToScreen(b.x, b.y);
        ctx.save();
        ctx.globalAlpha = 0.28;
        this.isoDiamond(ctx, p.x, p.y, tw, th, "rgba(53,255,154,0.20)", "rgba(53,255,154,0.55)");
        ctx.restore();
      }
    }
  }

  drawVignette(ctx) {
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    const g = ctx.createRadialGradient(
      w * 0.5,
      h * 0.55,
      Math.min(w, h) * 0.2,
      w * 0.5,
      h * 0.55,
      Math.max(w, h) * 0.75
    );
    g.addColorStop(0, "rgba(0,0,0,0.00)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  isoDiamond(ctx, cx, cy, tw, th, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - th / 2);
    ctx.lineTo(cx + tw / 2, cy);
    ctx.lineTo(cx, cy + th / 2);
    ctx.lineTo(cx - tw / 2, cy);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  isoPrism(ctx, cx, cy, tw, th, heightPx, colors, active) {
    const A = { x: cx, y: cy - th / 2 };
    const B = { x: cx + tw / 2, y: cy };
    const C = { x: cx, y: cy + th / 2 };
    const D = { x: cx - tw / 2, y: cy };

    const A2 = { x: A.x, y: A.y - heightPx };
    const B2 = { x: B.x, y: B.y - heightPx };
    const C2 = { x: C.x, y: C.y - heightPx };
    const D2 = { x: D.x, y: D.y - heightPx };

    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.72;

    // Face 1: left/front (D-C-C2-D2)
    ctx.beginPath();
    ctx.moveTo(D.x, D.y);
    ctx.lineTo(C.x, C.y);
    ctx.lineTo(C2.x, C2.y);
    ctx.lineTo(D2.x, D2.y);
    ctx.closePath();
    ctx.fillStyle = colors.left;
    ctx.fill();
    ctx.strokeStyle = colors.edge;
    ctx.stroke();

    // Face 2: right/front (B-C-C2-B2)
    ctx.beginPath();
    ctx.moveTo(B.x, B.y);
    ctx.lineTo(C.x, C.y);
    ctx.lineTo(C2.x, C2.y);
    ctx.lineTo(B2.x, B2.y);
    ctx.closePath();
    ctx.fillStyle = colors.right;
    ctx.fill();
    ctx.strokeStyle = colors.edge;
    ctx.stroke();

    // Back face hint (A-B-B2-A2)
    ctx.globalAlpha *= 0.85;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.lineTo(B.x, B.y);
    ctx.lineTo(B2.x, B2.y);
    ctx.lineTo(A2.x, A2.y);
    ctx.closePath();
    ctx.fillStyle = colors.front;
    ctx.fill();
    ctx.strokeStyle = colors.edge;
    ctx.stroke();

    ctx.globalAlpha = active ? 1 : 0.72;

    // Top face (A2-B2-C2-D2)
    ctx.beginPath();
    ctx.moveTo(A2.x, A2.y);
    ctx.lineTo(B2.x, B2.y);
    ctx.lineTo(C2.x, C2.y);
    ctx.lineTo(D2.x, D2.y);
    ctx.closePath();
    ctx.fillStyle = colors.top;
    ctx.fill();
    ctx.strokeStyle = colors.edge;
    ctx.stroke();

    // Gloss highlight
    ctx.globalAlpha = active ? 0.18 : 0.10;
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.beginPath();
    ctx.moveTo(A2.x, A2.y);
    ctx.lineTo(B2.x, B2.y);
    ctx.lineTo(B2.x, lerp(B2.y, B.y, 0.3));
    ctx.lineTo(A2.x, lerp(A2.y, A.y, 0.3));
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  getIconImage(type, bg, active) {
    const stroke = active ? "#EAF2FF" : "rgba(230,230,240,0.65)";
    const fill = active ? bg : "rgba(120,130,150,0.5)";
    const key = `${type}|${fill}|${stroke}`;
    if (this.iconCache.has(key)) return this.iconCache.get(key);

    let glyph = "";
    if (type === "house") {
      glyph = `
  <path d="M8 16 L16 9 L24 16" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" />
  <rect x="9" y="16" width="14" height="9" fill="none" stroke="${stroke}" stroke-width="2" />
  <rect x="14" y="19" width="4" height="6" fill="${stroke}" />`;
    } else if (type === "office") {
      glyph = `
  <rect x="9" y="8" width="14" height="16" fill="none" stroke="${stroke}" stroke-width="2" />
  <path d="M12 12 H20 M12 16 H20 M12 20 H20" stroke="${stroke}" stroke-width="2" />`;
    } else if (type === "factory") {
      glyph = `
  <rect x="7" y="20" width="18" height="5" fill="none" stroke="${stroke}" stroke-width="2" />
  <path d="M7 20 V12 L11 14 L15 12 L19 14 L23 12 V20" fill="none" stroke="${stroke}" stroke-width="2" />
  <rect x="22" y="8" width="3" height="6" fill="${stroke}" />`;
    } else if (type === "park") {
      glyph = `
  <circle cx="17" cy="12" r="5" fill="none" stroke="${stroke}" stroke-width="2" />
  <rect x="15" y="17" width="4" height="7" fill="${stroke}" />`;
    } else if (type === "mall") {
      glyph = `
  <rect x="8" y="13" width="16" height="10" fill="none" stroke="${stroke}" stroke-width="2" />
  <path d="M8 13 L10 9 H22 L24 13" fill="none" stroke="${stroke}" stroke-width="2" />`;
    } else if (type === "hospital") {
      glyph = `
  <path d="M16 9 V23 M9 16 H23" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" />`;
    } else if (type === "school") {
      glyph = `
  <path d="M9 13 L16 9 L23 13" fill="none" stroke="${stroke}" stroke-width="2" />
  <rect x="9" y="13" width="14" height="10" fill="none" stroke="${stroke}" stroke-width="2" />`;
    } else {
      glyph = `
  <circle cx="16" cy="16" r="5" fill="none" stroke="${stroke}" stroke-width="2" />`;
    }

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="15" fill="${fill}" />
  ${glyph}
</svg>`;
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    this.iconCache.set(key, img);
    return img;
  }
}
