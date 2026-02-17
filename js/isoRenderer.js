import { clamp, lerp } from "./utils.js";
import { CONFIG } from "./config.js";

export class IsoRenderer {
  static SPRITE_TYPES = new Set(["house", "school", "office", "factory", "hospital", "mall", "park"]);

  constructor(canvas, state) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.state = state;
    this.iconCache = new Map();
    this.spriteCache = new Map();
    this.spriteMetaCache = new Map();
    this.spriteState = new Map();
    this.spriteWarned = new Set();
    this.tintedSpriteCache = new Map();

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

    // warmer terrain palette (Alt01-inspired)
    const light = "#efe7db";
    const dark = "#e7dfd3";
    const fill = (x + y) % 2 === 0 ? light : dark;
    const edge = "rgba(0,0,0,0.04)";

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

  getBuildingFacingDirection(b) {
    const mask = this.roadMask(b.x, b.y);
    // Prefer roads on the "front" half-plane for the current isometric look.
    const options = ["s", "e", "w", "n"];
    for (const d of options) {
      if (mask[d]) return d;
    }
    return "s";
  }

  rotateDirClockwise(dir, steps) {
    const order = ["n", "e", "s", "w"];
    const i = order.indexOf(dir);
    if (i < 0) return "s";
    const n = ((steps % 4) + 4) % 4;
    return order[(i + n) % 4];
  }

  drawBuilding(id) {
    const ctx = this.ctx;
    const b = this.state.buildings.get(id);
    if (!b) return;

    const p = this.gridToScreen(b.x, b.y);
    const tw = CONFIG.tileW * this.camera.zoom;
    const th = CONFIG.tileH * this.camera.zoom;

    const worldFacing = this.getBuildingFacingDirection(b);
    const screenFacing = this.rotateDirClockwise(worldFacing, this.camera.rot);
    const spriteSpec = this.getBuildingSpriteSpec(b.type, screenFacing);
    if (spriteSpec) {
      const tintColor = this.state.getBuildingColors(b.type)?.top || "#ffffff";
      const spriteStatus = this.drawBuildingSprite(spriteSpec, p.x, p.y, tw, th, b.active, tintColor);
      if (spriteStatus === "drawn") return;
      if (spriteStatus === "pending") return;
      if (spriteStatus === "error") {
        this.drawMissingSpriteMarker(p.x, p.y, tw, th);
        return;
      }
    }

    if (IsoRenderer.SPRITE_TYPES.has(b.type)) {
      this.drawMissingSpriteMarker(p.x, p.y, tw, th);
      return;
    }

    if (b.type === "park") {
      this.drawParkTile(p.x, p.y, tw, th, b.active);
      return;
    }

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

    if (b.type === "house") {
      this.drawHouseSolid(p.x, p.y, tw, th, h * th * 1.85, colors, active);
      return;
    }
    if (b.type === "school") {
      this.drawSchoolSolid(p.x, p.y, tw, th, h * th * 1.85, colors, active);
      return;
    }
    if (b.type === "office") {
      this.drawOfficeSolid(p.x, p.y, tw, th, h * th * 1.85, colors, active);
      return;
    }
    if (b.type === "factory") {
      this.drawFactorySolid(p.x, p.y, tw, th, h * th * 1.85, colors, active);
      return;
    }
    if (b.type === "hospital") {
      this.drawHospitalSolid(p.x, p.y, tw, th, h * th * 1.85, colors, active);
      return;
    }
    if (b.type === "mall") {
      this.drawMallSolid(p.x, p.y, tw, th, h * th * 1.85, colors, active);
      return;
    }

    // soft shadow
    ctx.save();
    ctx.globalAlpha = active ? 0.32 : 0.2;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + th * 0.22, tw * 0.26, th * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // isometric prism (fallback)
    const heightPx = h * th * 1.85;
    this.isoPrism(ctx, p.x, p.y, tw, th, heightPx, colors, active);

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

  drawParkTile(cx, cy, tw, th, active) {
    const ctx = this.ctx;
    const grass = active ? "#bfe6b5" : "#a7c8a2";
    const edge = "rgba(0,0,0,0.06)";
    const s = 0.92;
    this.isoDiamond(ctx, cx, cy, tw * s, th * s, grass, edge);

    // soft shadow for trees
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.ellipse(cx - tw * 0.18, cy + th * 0.12, tw * 0.14, th * 0.07, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + tw * 0.16, cy + th * 0.10, tw * 0.14, th * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();

    // trunks
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#7a5a3a";
    ctx.fillRect(cx - tw * 0.20, cy + th * 0.00, tw * 0.04, th * 0.18);
    ctx.fillRect(cx + tw * 0.14, cy - th * 0.02, tw * 0.04, th * 0.18);

    // foliage
    ctx.fillStyle = active ? "#6fbf62" : "#5fae57";
    ctx.beginPath();
    ctx.ellipse(cx - tw * 0.19, cy - th * 0.10, tw * 0.18, th * 0.20, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + tw * 0.15, cy - th * 0.11, tw * 0.18, th * 0.20, 0, 0, Math.PI * 2);
    ctx.ellipse(cx - tw * 0.01, cy - th * 0.14, tw * 0.10, th * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.25;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.ellipse(cx - tw * 0.22, cy - th * 0.14, tw * 0.07, th * 0.07, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + tw * 0.12, cy - th * 0.15, tw * 0.07, th * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  getBuildingSpriteSpec(type, facing = "s") {
    const sprites = CONFIG.buildingSprites;
    const spec = sprites?.[type];
    const fallbackName = type === "school" ? "university" : type;
    const fallbackScale = {
      house: 0.42,
      school: 0.42,
      office: 0.44,
      factory: 0.41,
      hospital: 0.41,
      mall: 0.41,
      park: 0.40,
    };
    const fallback = IsoRenderer.SPRITE_TYPES.has(type)
      ? {
          src: `assets/glb-sprites/dir/${fallbackName}_${facing}.png`,
          scale: fallbackScale[type] ?? 0.42,
          xOffset: 0,
          yOffset: 0,
          tint: false,
        }
      : null;

    if (!spec) return fallback;
    if (typeof spec === "string") return { src: spec };
    if (spec.dirs && typeof spec.dirs === "object") {
      const src =
        spec.dirs[facing] ||
        spec.dirs.s ||
        spec.dirs.e ||
        spec.dirs.w ||
        spec.dirs.n ||
        spec.src ||
        fallback?.src;
      if (!src) return fallback;
      return { ...spec, src };
    }
    return spec;
  }

  getSpriteImage(src) {
    if (!src) return null;
    const version = CONFIG.assetVersion;
    const resolvedSrc = version
      ? `${src}${src.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`
      : src;
    if (this.spriteCache.has(resolvedSrc)) return this.spriteCache.get(resolvedSrc);
    const img = new Image();
    img.decoding = "async";
    this.spriteState.set(resolvedSrc, "loading");
    img.onload = () => {
      this.spriteState.set(resolvedSrc, "ready");
    };
    img.onerror = () => {
      this.spriteState.set(resolvedSrc, "error");
      if (!this.spriteWarned.has(resolvedSrc)) {
        this.spriteWarned.add(resolvedSrc);
        // keep this lightweight and one-time per asset
        console.warn(`Sprite failed to load: ${resolvedSrc}`);
      }
    };
    img.src = resolvedSrc;
    this.spriteCache.set(resolvedSrc, img);
    return img;
  }

  getSpriteMeta(img) {
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    const key = img.src;
    if (this.spriteMetaCache.has(key)) return this.spriteMetaCache.get(key);

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h).data;

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    const alphaMin = 8;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = data[(y * w + x) * 4 + 3];
        if (a > alphaMin) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Fallback when image is unexpectedly empty.
    if (maxX < minX || maxY < minY) {
      const fallback = {
        centerX: w / 2,
        bottomY: h,
      };
      this.spriteMetaCache.set(key, fallback);
      return fallback;
    }

    const meta = {
      centerX: (minX + maxX + 1) * 0.5,
      bottomY: maxY + 1,
    };
    this.spriteMetaCache.set(key, meta);
    return meta;
  }

  getTintedSprite(img, tintColor, alpha = 0.35) {
    const key = `${img.src}|${tintColor}|${alpha}`;
    if (this.tintedSpriteCache.has(key)) return this.tintedSpriteCache.get(key);
    if (!img.naturalWidth || !img.naturalHeight) return null;

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = tintColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = "source-over";
    this.tintedSpriteCache.set(key, canvas);
    return canvas;
  }

  drawBuildingSprite(spec, cx, cy, tw, th, active, tintColor) {
    const ctx = this.ctx;
    const img = this.getSpriteImage(spec.src);
    if (!img) return "pending";
    const state = this.spriteState.get(img.src);
    if (state === "error") return "error";
    if (!img.complete) return "pending";
    if (img.naturalWidth === 0 || img.naturalHeight === 0) return "error";
    const meta = this.getSpriteMeta(img);
    if (!meta) return "error";

    const scale = (spec.scale ?? 1) * this.camera.zoom;
    const xOffset = (spec.xOffset ?? 0) * this.camera.zoom;
    const yOffset = (spec.yOffset ?? 0) * this.camera.zoom;

    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    const anchorX = cx + xOffset;
    const anchorY = cy + th * 0.5 + yOffset;
    const drawX = -meta.centerX * scale;
    const drawY = -meta.bottomY * scale;

    const useTint = spec.tint !== false;
    const tintAlpha = spec.tintAlpha ?? 0.35;
    const sprite = useTint ? this.getTintedSprite(img, tintColor, tintAlpha) : img;
    if (!sprite) return "error";

    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.85;
    ctx.imageSmoothingEnabled = true;
    ctx.translate(anchorX, anchorY);
    // Alpha-content anchoring keeps the asset seated on one tile.
    ctx.drawImage(sprite, drawX, drawY, w, h);
    ctx.restore();
    return "drawn";
  }

  drawMissingSpriteMarker(cx, cy, tw, th) {
    const ctx = this.ctx;
    const r = Math.max(4, tw * 0.06);
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "rgba(240,80,80,0.9)";
    ctx.beginPath();
    ctx.arc(cx, cy + th * 0.2, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.5, cy + th * 0.2 - r * 0.5);
    ctx.lineTo(cx + r * 0.5, cy + th * 0.2 + r * 0.5);
    ctx.moveTo(cx + r * 0.5, cy + th * 0.2 - r * 0.5);
    ctx.lineTo(cx - r * 0.5, cy + th * 0.2 + r * 0.5);
    ctx.stroke();
    ctx.restore();
  }


  drawHouseSolid(cx, cy, tw, th, heightPx, colors, active) {
    const ctx = this.ctx;
    const baseH = heightPx * 0.7;
    const roofH = heightPx * 0.35;
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.8;
    this.isoPrism(ctx, cx, cy, tw * 0.86, th * 0.82, baseH, colors, active);
    // porch block
    this.isoPrism(ctx, cx - tw * 0.16, cy + th * 0.12, tw * 0.34, th * 0.26, baseH * 0.35, colors, active);
    // roof block
    this.isoPrism(ctx, cx, cy - th * 0.10, tw * 0.76, th * 0.70, roofH, {
      top: colors.top,
      left: colors.left,
      right: colors.right,
      front: colors.front,
      edge: colors.edge,
    }, active);
    // chimney
    this.isoPrism(ctx, cx + tw * 0.16, cy - th * 0.18, tw * 0.18, th * 0.18, roofH * 0.7, colors, active);
    ctx.restore();
  }

  drawSchoolSolid(cx, cy, tw, th, heightPx, colors, active) {
    const ctx = this.ctx;
    const baseH = heightPx * 0.75;
    const roofH = heightPx * 0.35;
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.8;
    // main hall
    this.isoPrism(ctx, cx, cy, tw * 1.05, th * 0.90, baseH, colors, active);
    // roof block
    this.isoPrism(ctx, cx, cy - th * 0.14, tw * 0.90, th * 0.66, roofH, colors, active);
    // left wing
    this.isoPrism(ctx, cx - tw * 0.36, cy + th * 0.08, tw * 0.55, th * 0.45, baseH * 0.55, colors, active);
    // right wing
    this.isoPrism(ctx, cx + tw * 0.36, cy + th * 0.08, tw * 0.55, th * 0.45, baseH * 0.55, colors, active);
    // bell tower
    this.isoPrism(ctx, cx - tw * 0.18, cy - th * 0.20, tw * 0.30, th * 0.30, roofH * 1.0, colors, active);
    // flag (solid)
    ctx.fillStyle = colors.top;
    ctx.fillRect(cx - tw * 0.30, cy - heightPx * 1.05, tw * 0.18, th * 0.08);
    ctx.restore();
  }

  drawOfficeSolid(cx, cy, tw, th, heightPx, colors, active) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.8;
    // main tower
    this.isoPrism(ctx, cx, cy, tw * 0.80, th * 0.78, heightPx * 1.25, colors, active);
    // mid setback
    this.isoPrism(ctx, cx - tw * 0.02, cy - th * 0.06, tw * 0.64, th * 0.62, heightPx * 0.7, colors, active);
    // side wing
    this.isoPrism(ctx, cx - tw * 0.28, cy + th * 0.08, tw * 0.62, th * 0.52, heightPx * 0.55, colors, active);
    // roof cap
    this.isoPrism(ctx, cx + tw * 0.04, cy - th * 0.22, tw * 0.34, th * 0.34, heightPx * 0.25, colors, active);
    ctx.restore();
  }

  drawFactorySolid(cx, cy, tw, th, heightPx, colors, active) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.8;
    // low wide base
    this.isoPrism(ctx, cx, cy, tw * 1.12, th * 0.82, heightPx * 0.6, colors, active);
    // warehouse wing
    this.isoPrism(ctx, cx - tw * 0.36, cy + th * 0.10, tw * 0.72, th * 0.46, heightPx * 0.35, colors, active);
    // sawtooth roof blocks
    for (let i = -2; i <= 2; i++) {
      this.isoPrism(ctx, cx + tw * 0.14 * i, cy - th * 0.12, tw * 0.30, th * 0.30, heightPx * 0.26, colors, active);
    }
    // smokestacks
    this.isoPrism(ctx, cx + tw * 0.30, cy - th * 0.14, tw * 0.24, th * 0.24, heightPx * 1.0, colors, active);
    this.isoPrism(ctx, cx + tw * 0.08, cy - th * 0.12, tw * 0.22, th * 0.22, heightPx * 0.8, colors, active);
    ctx.restore();
  }

  drawHospitalSolid(cx, cy, tw, th, heightPx, colors, active) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.8;
    // base block
    this.isoPrism(ctx, cx, cy, tw * 0.95, th * 0.85, heightPx * 0.65, colors, active);
    // left wing
    this.isoPrism(ctx, cx - tw * 0.34, cy + th * 0.08, tw * 0.60, th * 0.45, heightPx * 0.5, colors, active);
    // right wing
    this.isoPrism(ctx, cx + tw * 0.34, cy + th * 0.08, tw * 0.60, th * 0.45, heightPx * 0.5, colors, active);
    // center tower
    this.isoPrism(ctx, cx, cy - th * 0.14, tw * 0.58, th * 0.58, heightPx * 0.75, colors, active);
    // cross (solid)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - tw * 0.06, cy - heightPx * 1.05, tw * 0.12, th * 0.30);
    ctx.fillRect(cx - tw * 0.18, cy - heightPx * 0.95, tw * 0.36, th * 0.12);
    ctx.restore();
  }

  drawMallSolid(cx, cy, tw, th, heightPx, colors, active) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.8;
    // low wide base
    this.isoPrism(ctx, cx, cy, tw * 1.18, th * 0.84, heightPx * 0.45, colors, active);
    // atrium block
    this.isoPrism(ctx, cx + tw * 0.10, cy - th * 0.06, tw * 0.70, th * 0.52, heightPx * 0.55, colors, active);
    // front canopy
    this.isoPrism(ctx, cx, cy + th * 0.10, tw * 1.04, th * 0.30, heightPx * 0.18, colors, active);
    ctx.restore();
  }

  drawBuildingAccent(ctx, b, cx, cy, tw, th, heightPx, colors, active) {
    const topY = cy - heightPx;
    ctx.save();
    ctx.globalAlpha = active ? 0.95 : 0.6;

    const softStroke = active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.35)";

    // glossy top plate to make roofs read more clearly
    ctx.save();
    ctx.globalAlpha = active ? 0.45 : 0.25;
    this.isoDiamond(ctx, cx, topY + th * 0.06, tw * 0.62, th * 0.62, "rgba(255,255,255,0.22)", "rgba(255,255,255,0.28)");
    ctx.restore();

    if (b.type === "factory") {
      // twin smokestacks + sawtooth roof + faint smoke
      ctx.fillStyle = colors.right;
      ctx.fillRect(cx + tw * 0.08, topY - th * 0.16, tw * 0.13, th * 0.42);
      ctx.fillRect(cx - tw * 0.05, topY - th * 0.12, tw * 0.11, th * 0.34);
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(cx + tw * 0.08, topY - th * 0.16, tw * 0.13, th * 0.05);
      ctx.fillRect(cx - tw * 0.05, topY - th * 0.12, tw * 0.11, th * 0.04);

      ctx.strokeStyle = softStroke;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - tw * 0.18, topY + th * 0.02);
      ctx.lineTo(cx - tw * 0.08, topY - th * 0.04);
      ctx.lineTo(cx + tw * 0.02, topY + th * 0.02);
      ctx.lineTo(cx + tw * 0.12, topY - th * 0.04);
      ctx.lineTo(cx + tw * 0.22, topY + th * 0.02);
      ctx.stroke();

      ctx.globalAlpha *= 0.7;
      ctx.fillStyle = "rgba(40,50,70,0.25)";
      ctx.fillRect(cx - tw * 0.18, topY + th * 0.16, tw * 0.36, th * 0.08);
      ctx.globalAlpha *= 0.6;
      ctx.fillStyle = "rgba(210,220,235,0.55)";
      ctx.beginPath();
      ctx.ellipse(cx + tw * 0.16, topY - th * 0.26, tw * 0.12, th * 0.08, 0, 0, Math.PI * 2);
      ctx.ellipse(cx + tw * 0.22, topY - th * 0.36, tw * 0.14, th * 0.10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = active ? 0.95 : 0.6;
    }

    if (b.type === "school") {
      // gable roof + flag
      ctx.strokeStyle = colors.edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - tw * 0.14, topY - th * 0.05);
      ctx.lineTo(cx, topY - th * 0.18);
      ctx.lineTo(cx + tw * 0.14, topY - th * 0.05);
      ctx.stroke();
      ctx.fillStyle = colors.top;
      ctx.beginPath();
      ctx.moveTo(cx - tw * 0.14, topY - th * 0.05);
      ctx.lineTo(cx, topY - th * 0.18);
      ctx.lineTo(cx + tw * 0.14, topY - th * 0.05);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = colors.edge;
      ctx.beginPath();
      ctx.moveTo(cx - tw * 0.20, topY - th * 0.02);
      ctx.lineTo(cx - tw * 0.20, topY - th * 0.20);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.fillRect(cx - tw * 0.20, topY - th * 0.20, tw * 0.10, th * 0.05);

      // front door + windows
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(cx - tw * 0.05, topY + th * 0.18, tw * 0.10, th * 0.18);
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      for (let i = -2; i <= 2; i++) {
        if (i === 0) continue;
        ctx.fillRect(cx + tw * 0.06 * i, topY + th * 0.12, tw * 0.04, th * 0.06);
      }
    }

    if (b.type === "hospital") {
      // roof cross
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(cx - tw * 0.05, topY - th * 0.14, tw * 0.10, th * 0.28);
      ctx.fillRect(cx - tw * 0.14, topY - th * 0.05, tw * 0.28, th * 0.10);
      ctx.globalAlpha *= 0.5;
      ctx.strokeStyle = "rgba(140,220,255,0.65)";
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - tw * 0.06, topY - th * 0.16, tw * 0.12, th * 0.32);
      ctx.globalAlpha = active ? 0.95 : 0.6;
    }

    if (b.type === "mall") {
      // awning band + stripes
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(cx - tw * 0.20, topY - th * 0.04, tw * 0.40, th * 0.12);
      ctx.fillStyle = "rgba(255,255,255,0.65)";
      for (let i = -4; i <= 4; i++) {
        ctx.fillRect(cx + tw * 0.02 * i, topY - th * 0.04, tw * 0.012, th * 0.10);
      }
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(cx - tw * 0.12, topY + th * 0.14, tw * 0.24, th * 0.08);
    }

    if (b.type === "office") {
      // antenna + window strip
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx + tw * 0.12, topY - th * 0.02);
      ctx.lineTo(cx + tw * 0.12, topY - th * 0.24);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + tw * 0.12, topY - th * 0.26, tw * 0.018, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.38)";
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(cx - tw * 0.09, topY + th * (0.02 + i * 0.10), tw * 0.18, th * 0.05);
      }
      ctx.globalAlpha *= 0.7;
      ctx.strokeStyle = softStroke;
      ctx.beginPath();
      ctx.moveTo(cx + tw * 0.02, topY + th * 0.02);
      ctx.lineTo(cx + tw * 0.18, topY + th * 0.10);
      ctx.stroke();
      ctx.globalAlpha = active ? 0.95 : 0.6;
    }

    if (b.type === "house") {
      // gable ridge + small chimney
      ctx.strokeStyle = colors.edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - tw * 0.12, topY - th * 0.02);
      ctx.lineTo(cx + tw * 0.12, topY - th * 0.02);
      ctx.stroke();
      ctx.fillStyle = colors.right;
      ctx.fillRect(cx + tw * 0.06, topY - th * 0.16, tw * 0.05, th * 0.12);
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.fillRect(cx - tw * 0.08, topY + th * 0.18, tw * 0.06, th * 0.08);
      ctx.fillRect(cx + tw * 0.02, topY + th * 0.18, tw * 0.06, th * 0.08);
    }

    if (b.type === "factory" || b.type === "school" || b.type === "mall" || b.type === "office") {
      ctx.globalAlpha *= 0.65;
      ctx.strokeStyle = softStroke;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - tw * 0.18, topY + th * 0.02);
      ctx.lineTo(cx + tw * 0.18, topY + th * 0.02);
      ctx.stroke();
    }

    ctx.restore();
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
