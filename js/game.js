import { CONFIG } from "./config.js?v=2026-02-15-renderer-hotfix-1";
import { uid, clamp, inBounds } from "./utils.js?v=2026-02-15-renderer-hotfix-1";
import { IsoRenderer } from "./isoRenderer.js?v=2026-02-15-renderer-hotfix-1";
import { RoadGraph } from "./pathfinding.js?v=2026-02-15-renderer-hotfix-1";
import { computeMetrics } from "./metrics.js?v=2026-02-15-renderer-hotfix-1";
import { UI } from "./ui.js?v=2026-02-15-renderer-hotfix-1";
import { initDebug, logEvent, captureCanvasScreenshot } from "./debugTools.js?v=2026-02-15-renderer-hotfix-1";
import { openModelEditor } from "./modelEditor.js?v=2026-02-15-renderer-hotfix-1";
import { openBuildingEditor } from "./buildingEditor.js?v=2026-02-15-renderer-hotfix-1";

// -----------------------
// Game State
// -----------------------
class GameState {
    constructor() {
        this.gridW = CONFIG.gridW;
        this.gridH = CONFIG.gridH;

        this.grid = [];
        this.buildings = new Map(); // id -> building
        this.selected = null;

        this.tool = "road";         // road | move | bulldoze | build
        this.buildType = "house";   // when tool=build

        this._initGrid();
    }

    _initGrid() {
        this.grid = Array.from({ length: this.gridH }, () => (
            Array.from({ length: this.gridW }, () => ({ road: false, buildingId: null }))
        ));
    }

    reset() {
        this._initGrid();
        this.buildings.clear();
        this.selected = null;
    }

    getBuildingIcon(type) {
        return ({
            house: "🏠", school: "🏫", office: "🏢", factory: "🏭", hospital: "🏥", mall: "🛍️", park: "🌳"
        })[type] ?? "🏗️";
    }

    getBuildingColors(type) {
        // tuned for isometric shading
        const palette = {
            house: { top: "#9db7ff", left: "#5a7dd2", right: "#7ea1ee", front: "#6c8ce0", edge: "rgba(0,0,0,0.25)" },
            school: { top: "#d5b2ff", left: "#9463d8", right: "#b58af2", front: "#a778ea", edge: "rgba(0,0,0,0.25)" },
            office: { top: "#8bffd2", left: "#38c38f", right: "#64e8b1", front: "#50dca5", edge: "rgba(0,0,0,0.25)" },
            factory: { top: "#ff9aaa", left: "#cf5a70", right: "#e77a90", front: "#db6b82", edge: "rgba(0,0,0,0.25)" },
            hospital: { top: "#9feeff", left: "#4fb7c9", right: "#7ad6e6", front: "#67c9dc", edge: "rgba(0,0,0,0.25)" },
            mall: { top: "#ffd27a", left: "#c8943d", right: "#e9b85f", front: "#dca650", edge: "rgba(0,0,0,0.25)" },
            park: { top: "#8deba7", left: "#3fbf6a", right: "#69df8a", front: "#55d17b", edge: "rgba(0,0,0,0.25)" },
        };
        return palette[type] ?? palette.house;
    }

    placeRoad(x, y) {
        if (!inBounds(x, y, this.gridW, this.gridH)) return false;
        if (this.grid[y][x].buildingId) return false;
        this.grid[y][x].road = true;
        return true;
    }

    toggleRoad(x, y) {
        if (!inBounds(x, y, this.gridW, this.gridH)) return false;
        if (this.grid[y][x].buildingId) return false;
        this.grid[y][x].road = !this.grid[y][x].road;
        return true;
    }

    removeRoad(x, y) {
        if (!inBounds(x, y, this.gridW, this.gridH)) return false;
        this.grid[y][x].road = false;
        return true;
    }

    placeBuilding(type, x, y) {
        if (!inBounds(x, y, this.gridW, this.gridH)) return { ok: false, reason: "Out of bounds" };
        const cell = this.grid[y][x];
        if (cell.road) return { ok: false, reason: "Can't build on a road" };
        if (cell.buildingId) return { ok: false, reason: "Tile occupied" };

        const id = uid(type);
        const b = { id, type, x, y, active: false, name: "", description: "", tasks: [] };
        this.buildings.set(id, b);
        cell.buildingId = id;
        return { ok: true, id };
    }

    removeBuildingAt(x, y) {
        if (!inBounds(x, y, this.gridW, this.gridH)) return false;
        const id = this.grid[y][x].buildingId;
        if (!id) return false;
        this.grid[y][x].buildingId = null;
        this.buildings.delete(id);
        if (this.selected?.id === id) this.selected = null;
        return true;
    }

    moveBuilding(id, nx, ny) {
        const b = this.buildings.get(id);
        if (!b) return { ok: false, reason: "Missing building" };
        if (!inBounds(nx, ny, this.gridW, this.gridH)) return { ok: false, reason: "Out of bounds" };
        const dst = this.grid[ny][nx];
        if (dst.road) return { ok: false, reason: "Can't move onto road" };
        if (dst.buildingId) return { ok: false, reason: "Tile occupied" };

        // clear old
        this.grid[b.y][b.x].buildingId = null;
        // set new
        b.x = nx; b.y = ny;
        dst.buildingId = id;
        return { ok: true };
    }

    buildingAt(x, y) {
        if (!inBounds(x, y, this.gridW, this.gridH)) return null;
        const id = this.grid[y][x].buildingId;
        if (!id) return null;
        return this.buildings.get(id) ?? null;
    }
}

// -----------------------
// Example City
// -----------------------
function loadExampleCity(state) {
    state.reset();

    // Main road spine + branches
    for (let x = 6; x <= 21; x++) state.placeRoad(x, 14);
    for (let y = 9; y <= 19; y++) state.placeRoad(12, y);
    for (let y = 11; y <= 17; y++) state.placeRoad(18, y);
    for (let x = 10; x <= 14; x++) state.placeRoad(x, 10);
    for (let x = 16; x <= 20; x++) state.placeRoad(x, 18);

    // Houses near roads
    state.placeBuilding("house", 10, 13);
    state.placeBuilding("house", 11, 13);
    state.placeBuilding("house", 10, 15);
    state.placeBuilding("house", 13, 13);
    state.placeBuilding("house", 13, 15);

    // Work cluster
    state.placeBuilding("office", 19, 13);
    state.placeBuilding("office", 20, 13);
    state.placeBuilding("factory", 19, 16);

    // Care + leisure
    state.placeBuilding("park", 14, 11);
    state.placeBuilding("mall", 16, 17);
    state.placeBuilding("hospital", 11, 18);
    state.placeBuilding("school", 14, 16);

    // A couple extras
    state.placeBuilding("park", 8, 15);
    state.placeBuilding("house", 8, 13);
}

// -----------------------
// Input / Tools
// -----------------------
function setupToolbar(state, ui) {
    const toolBtns = [...document.querySelectorAll(".toolbtn[data-tool]")];
    const buildBtns = [...document.querySelectorAll(".buildbtn[data-build]")];

    function setTool(tool) {
        state.tool = tool;
        state.selected = null;
        toolBtns.forEach(b => b.classList.toggle("active", b.dataset.tool === tool));
        // build tool visual state handled on build button click
        logEvent("info", "tool_changed", { tool });
    }

    function setBuild(type) {
        state.tool = "build";
        state.buildType = type;
        toolBtns.forEach(b => b.classList.toggle("active", false));
        buildBtns.forEach(b => b.classList.toggle("active", b.dataset.build === type));
        ui.showToast(`Build: ${type}`);
        logEvent("info", "build_selected", { type });
    }

    toolBtns.forEach(btn => {
        btn.addEventListener("click", () => setTool(btn.dataset.tool));
    });
    buildBtns.forEach(btn => {
        btn.addEventListener("click", () => setBuild(btn.dataset.build));
    });

    setTool("road");
}

function setupHotkeys(renderer, state) {
    window.addEventListener("keydown", (e) => {
        if (e.key === "q" || e.key === "Q") renderer.camera.rot = (renderer.camera.rot + 3) % 4;
        if (e.key === "e" || e.key === "E") renderer.camera.rot = (renderer.camera.rot + 1) % 4;
        if (e.key === "Escape") state.selected = null;
    });
}

// -----------------------
// Main
// -----------------------
const canvas = document.getElementById("gameCanvas");
const ui = new UI();
const state = new GameState();
loadExampleCity(state);

initDebug();
logEvent("info", "game_init", { gridW: state.gridW, gridH: state.gridH });

const renderer = new IsoRenderer(canvas, state);
renderer.centerOnWorld();
setupToolbar(state, ui);
setupHotkeys(renderer, state);

let lastCanvasSize = { w: 0, h: 0 };
function refreshLayout() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w !== lastCanvasSize.w || h !== lastCanvasSize.h) {
        lastCanvasSize = { w, h };
        renderer.resize(true);
    }
}
window.addEventListener("resize", refreshLayout);
requestAnimationFrame(refreshLayout);

let roadGraph = new RoadGraph(state);
let metrics = computeMetrics(state, roadGraph);
ui.pushHistory(metrics);
ui.update(metrics);

function recompute() {
    roadGraph.rebuild();
    metrics = computeMetrics(state, roadGraph);
    ui.pushHistory(metrics);
}

let lastTick = performance.now();

// Resize
function onResize() {
    renderer.resize();
}
window.addEventListener("resize", onResize);
onResize();

let spacePan = false;
window.addEventListener("keydown", (e)=>{ if(e.code==="Space") spacePan = true; });
window.addEventListener("keyup", (e)=>{ if(e.code==="Space") spacePan = false; });


// Mouse interaction: pan/zoom + paint/place/move/bulldoze
let isPanning = false;
let panBtn = 2; // right mouse
let lastMouse = { x: 0, y: 0 };
let isDraggingBuilding = false;
let dragStart = null;

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    renderer.setHoverTile(renderer.screenToGrid(mx, my));

    if (isPanning) {
        const dx = mx - lastMouse.x;
        const dy = my - lastMouse.y;
        renderer.camera.x += dx / renderer.camera.zoom;
        renderer.camera.y += dy / renderer.camera.zoom;
        lastMouse = { x: mx, y: my };
    }

    // Drag move
    if (isDraggingBuilding && state.selected?.kind === "building" && state.tool === "move") {
        const g = renderer.screenToGrid(mx, my);
        if (inBounds(g.x, g.y, state.gridW, state.gridH)) {
            const b = state.buildings.get(state.selected.id);
            if (b && (b.x !== g.x || b.y !== g.y)) {
                const r = state.moveBuilding(b.id, g.x, g.y);
                if (r.ok) {
                    recompute();
                }
            }
        }
    }
});

canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const isPanGesture = (e.button === panBtn || e.button === 1 || (e.button === 0 && spacePan));
    if (isPanGesture) {
        isPanning = true;
        lastMouse = { x: mx, y: my };
        return;
    }

    const g = renderer.screenToGrid(mx, my);
    if (!inBounds(g.x, g.y, state.gridW, state.gridH)) return;

    const cell = state.grid[g.y][g.x];
    const b = state.buildingAt(g.x, g.y);

    if (state.tool === "road") {
        // paint road on click, and allow drag painting by holding mouse down
        const ok = state.toggleRoad(g.x, g.y);
        if (ok) {
            recompute();
            ui.showToast(cell.road ? "Road removed" : "Road placed");
            logEvent("info", "road_toggled", { x: g.x, y: g.y, road: state.grid[g.y][g.x].road });
        }
    }
    else if (state.tool === "build") {
        const res = state.placeBuilding(state.buildType, g.x, g.y);
        if (!res.ok) {
            ui.showToast(res.reason);
            logEvent("warn", "build_failed", { type: state.buildType, x: g.x, y: g.y, reason: res.reason });
        } else {
            recompute();
            ui.showToast(`${state.buildType} placed`);
            logEvent("info", "build_placed", { type: state.buildType, x: g.x, y: g.y, id: res.id });
        }
    }
    else if (state.tool === "bulldoze") {
        const removedB = state.removeBuildingAt(g.x, g.y);
        const removedR = !removedB ? state.removeRoad(g.x, g.y) : false;
        if (removedB || removedR) {
            recompute();
            ui.showToast("Removed");
            logEvent("info", "bulldozed", { x: g.x, y: g.y, building: removedB, road: removedR });
        } else {
            ui.showToast("Nothing to remove");
            logEvent("warn", "bulldoze_empty", { x: g.x, y: g.y });
        }
    }
    else if (state.tool === "move") {
        if (b) {
            state.selected = { kind: "building", id: b.id };
            isDraggingBuilding = true;
            dragStart = { id: b.id, x: b.x, y: b.y };
            ui.showToast("Drag to move");
            logEvent("info", "move_start", { id: b.id, x: b.x, y: b.y });
        } else {
            state.selected = null;
        }
    }
});

canvas.addEventListener("mouseup", (e) => {
    isPanning = false;
    isDraggingBuilding = false;
    if (dragStart) {
        const b = state.buildings.get(dragStart.id);
        if (b) {
            const moved = b.x !== dragStart.x || b.y !== dragStart.y;
            logEvent("info", "move_end", { id: b.id, from: { x: dragStart.x, y: dragStart.y }, to: { x: b.x, y: b.y }, moved });
        }
        dragStart = null;
    }
});

canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.08;
    renderer.camera.zoom = clamp(renderer.camera.zoom * (1 + delta), CONFIG.zoomMin, CONFIG.zoomMax);
}, { passive: false });

// Buttons
document.getElementById("graphBtn").addEventListener("click", () => {
    // refresh metrics before opening graph
    recompute();
    logEvent("info", "graph_open", { buildings: state.buildings.size });
    import("./graphView.js?v=2026-02-15-renderer-hotfix-1")
        .then(mod => mod.openGraphModal(state, roadGraph, metrics))
        .catch(err => {
            logEvent("error", "graph_open_failed", { error: String(err) });
            ui.showToast("Graph failed — check console/logs");
        });
});

document.getElementById("modelBtn").addEventListener("click", () => {
    openModelEditor();
});

document.getElementById("buildingBtn").addEventListener("click", () => {
    openBuildingEditor(state);
});

document.getElementById("resetBtn").addEventListener("click", () => {
    loadExampleCity(state);
    renderer.centerOnWorld();
    recompute();
    ui.showToast("Loaded example city");
    logEvent("info", "reset_example_city");
});

document.getElementById("screenshotBtn").addEventListener("click", async () => {
    await captureCanvasScreenshot(canvas, "main");
    ui.showToast("Screenshot saved");
});

const graphModal = document.getElementById("graphModal");
document.getElementById("closeGraph").addEventListener("click", () => {
    graphModal.classList.add("hidden");
    graphModal.setAttribute("aria-hidden", "true");
});

// Animation loop
let renderFailed = false;
let lastRenderErrorAt = 0;
function loop(now) {
    const dt = now - lastTick;
    if (dt >= CONFIG.tickMs) {
        // periodic recompute so HUD trends update even if idle
        metrics = computeMetrics(state, roadGraph);
        ui.pushHistory(metrics);
        ui.update(metrics);
        lastTick = now;
    }

    try {
        renderer.draw();
        renderFailed = false;
    } catch (err) {
        const t = performance.now();
        if (!renderFailed || t - lastRenderErrorAt > 2000) {
            lastRenderErrorAt = t;
            renderFailed = true;
            logEvent("error", "render_failed", { message: String(err) });
            ui.showToast("Render error — check console/logs");
        }
    }

    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// initial update
recompute();
ui.update(metrics);
