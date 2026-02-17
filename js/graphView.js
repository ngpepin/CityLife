import { expFalloff, round2, clamp } from "./utils.js";
import { getModel } from "./model.js";
import { logEvent, captureGraphScreenshot, flushLogs } from "./debugTools.js";

export function openGraphModal(state, roadGraph, metrics) {
    const modal = document.getElementById("graphModal");
    const closeBtn = document.getElementById("closeGraph");
    const shotBtn = document.getElementById("graphShotBtn");
    const distanceBtn = document.getElementById("graphDistanceBtn");
    const info = document.getElementById("selectedInfo");
    const snap = document.getElementById("metricSnapshot");

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");

    snap.innerHTML = `
    <div><b>Income:</b> ${round2(metrics.income)}</div>
    <div><b>Happiness:</b> ${round2(metrics.happiness)}</div>
    <div><b>Wellness:</b> ${round2(metrics.wellness)}</div>
    <div><b>Population:</b> ${metrics.population}</div>
  `;

    const buildings = [...state.buildings.values()];
    const model = getModel();
    const g = model.globals;

    // node styling by category
    function nodeStyle(type) {
        if (type === "house") return { bg: "#7E9BFF" };
        if (type === "office") return { bg: "#67D8BE" };
        if (type === "factory") return { bg: "#E17582" };
        if (type === "park") return { bg: "#6BE5A0" };
        if (type === "mall") return { bg: "#D9B26A" };
        if (type === "hospital") return { bg: "#7CB8E6" };
        if (type === "school") return { bg: "#9C8CE8" };
        return { bg: "#9FB3D9" };
    }

    const nodes = buildings.map(b => {
        const st = nodeStyle(b.type);
        return {
            data: {
                id: b.id,
                type: b.type,
                tooltip: (b.name && b.name.trim().length) ? b.name.trim() : b.id,
                bg: st.bg,
                active: b.active
            },
            classes: b.active ? "active" : "inactive"
        };
    });

    // edges based on road distance & influence weight
    const edges = [];
    for (let i = 0; i < buildings.length; i++) {
        for (let j = i + 1; j < buildings.length; j++) {
            const A = buildings[i], B = buildings[j];
            if (!A.active || !B.active) continue;

            const d = roadGraph.roadDistanceBetweenBuildings(A, B, g.dMax);
            if (!Number.isFinite(d)) continue;

            const w = expFalloff(d, g.lambda);
            if (w < g.theta) continue;

            edges.push({
                data: {
                    id: `${A.id}__${B.id}`,
                    source: A.id,
                    target: B.id,
                    distance: d,
                    weight: w,
                    label: `d=${d}, w=${round2(w)}`
                }
            });
        }
    }

    // --- NEW: keep only top-N strongest edges per node ---
    const MAX_EDGES_PER_NODE = 4;

    const byNode = new Map(); // nodeId -> edge[]
    for (const e of edges) {
        const { source, target } = e.data;
        if (!byNode.has(source)) byNode.set(source, []);
        if (!byNode.has(target)) byNode.set(target, []);
        byNode.get(source).push(e);
        byNode.get(target).push(e);
    }

    const keep = new Set(); // edge ids to keep
    for (const [nodeId, list] of byNode.entries()) {
        list.sort((a, b) => b.data.weight - a.data.weight);
        for (const e of list.slice(0, MAX_EDGES_PER_NODE)) keep.add(e.data.id);
    }

    const edgesFiltered = edges.filter(e => keep.has(e.data.id));


    const cyEl = document.getElementById("cy");
    cyEl.innerHTML = ""; // clear any previous instance

    function svgIconDataUrl(type, bg) {
        const stroke = "#EAF2FF";
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
  <circle cx="16" cy="16" r="15" fill="${bg}" />
  ${glyph}
</svg>`;

        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    }

    function initGraph(visLib) {
        const rect = cyEl.getBoundingClientRect();
        if (rect.width < 10 || rect.height < 10) {
            logEvent("warn", "graph_container_too_small", { w: rect.width, h: rect.height });
            requestAnimationFrame(() => initGraph(visLib));
            return null;
        }

        const nodeById = new Map();
        const edgeById = new Map();

        const nodeItems = nodes.map(n => {
            const active = n.classes === "active";
            const bg = n.data.bg;
            const inactiveBg = "rgba(190,200,220,0.30)";
            const border = active ? "rgba(255,255,255,0.20)" : "rgba(255,180,120,0.28)";
            const item = {
                id: n.data.id,
                label: "",
                title: n.data.tooltip,
                shape: "circularImage",
                image: svgIconDataUrl(n.data.type, active ? bg : inactiveBg),
                borderWidth: active ? 0.9 : 0.7,
                size: active ? 14 : 12,
                shadow: {
                    enabled: true,
                    color: "rgba(0,0,0,0.55)",
                    size: 10,
                    x: 0,
                    y: 3
                },
                active: n.data.active,
                type: n.data.type
            };
            nodeById.set(item.id, item);
            return item;
        });

        // Seed initial positions in a circle to guarantee visibility
        const radius = 220;
        nodeItems.forEach((item, i) => {
            const angle = (i / Math.max(1, nodeItems.length)) * Math.PI * 2;
            item.x = Math.cos(angle) * radius;
            item.y = Math.sin(angle) * radius;
        });

        const edgeItems = edgesFiltered.map(e => {
            const w = e.data.weight;
            const width = 0.6 + w * 1.4;
            const opacity = 0.35 + w * 0.5;
            const item = {
                id: e.data.id,
                from: e.data.source,
                to: e.data.target,
                width,
                color: {
                    color: `rgba(120,150,210,${opacity})`,
                    highlight: "rgba(160,185,255,0.80)",
                    hover: "rgba(160,185,255,0.70)"
                },
                smooth: { type: "dynamic", roundness: 0.35 },
                length: 150,
                distance: e.data.distance,
                weight: e.data.weight
            };
            edgeById.set(item.id, item);
            return item;
        });

        if (nodeItems.length === 0) {
            info.innerHTML = "No nodes to display. Build a few structures first.";
            return null;
        }

        const data = { nodes: nodeItems, edges: edgeItems };
        const options = {
            autoResize: true,
            layout: {
                improvedLayout: true,
                randomSeed: 2
            },
            interaction: {
                hover: true,
                multiselect: false,
                dragNodes: true,
                dragView: true,
                zoomView: true
            },
            nodes: {
                shape: "dot",
                scaling: { min: 10, max: 18 },
                shadow: true
            },
            edges: {
                smooth: { type: "dynamic" },
                selectionWidth: 1.6,
                hoverWidth: 1.4,
                shadow: false
            },
            physics: {
                enabled: true,
                solver: "forceAtlas2Based",
                stabilization: { enabled: true, iterations: 300, updateInterval: 25, fit: false },
                forceAtlas2Based: {
                    gravitationalConstant: -45,
                    centralGravity: 0.02,
                    springLength: 150,
                    springConstant: 0.07,
                    damping: 0.35,
                    avoidOverlap: 0.8
                },
                maxVelocity: 40,
                minVelocity: 0.02,
                timestep: 0.5,
                adaptiveTimestep: true
            }
        };

        const network = new visLib.Network(cyEl, data, options);
        logEvent("info", "graph_network_created", { nodes: nodeItems.length, edges: edgeItems.length });

        const tip = document.getElementById("graphTooltip");

        let hoveredNodeId = null;
        let hoveredEdgeId = null;

        network.on("hoverNode", (params) => {
            hoveredNodeId = params.node;
            hoveredEdgeId = null;
            const n = nodeById.get(params.node);
            tip.textContent = n?.title || "";
            tip.classList.remove("hidden");
        });

        network.on("blurNode", () => {
            hoveredNodeId = null;
            tip.classList.add("hidden");
        });

        network.on("hoverEdge", (params) => {
            hoveredEdgeId = params.edge;
            hoveredNodeId = null;
            tip.textContent = params.edge;
            tip.classList.remove("hidden");
        });

        network.on("blurEdge", () => {
            hoveredEdgeId = null;
            tip.classList.add("hidden");
        });

        network.on("mousemove", (params) => {
            if (!hoveredNodeId && !hoveredEdgeId) return;
            const rect = cyEl.getBoundingClientRect();
            const tipRect = tip.getBoundingClientRect();
            const pos = params.pointer.DOM;

            const pad = 10;
            let x = pos.x + 12;
            let y = pos.y - 8;

            const maxX = rect.width - tipRect.width - pad;
            const maxY = rect.height - tipRect.height - pad;
            x = Math.max(pad, Math.min(x, maxX));
            y = Math.max(pad, Math.min(y, maxY));

            tip.style.left = `${x}px`;
            tip.style.top = `${y}px`;
        });

        network.on("selectNode", (params) => {
            const n = nodeById.get(params.nodes[0]);
            if (!n) return;
            info.innerHTML = `
    <div><b>${n.id}</b></div>
    <div>Active: <b>${n.active ? "Yes" : "No (needs road)"}</b></div>
    <div style="margin-top:8px;color:rgba(255,255,255,0.75)">
      Move this building closer/farther to rebalance influence.
    </div>
  `;
            logEvent("info", "graph_node_selected", { id: n.id, type: n.type, active: n.active });
        });

        network.on("selectEdge", (params) => {
            const e = edgeById.get(params.edges[0]);
            if (!e) return;
            info.innerHTML = `
      <div><b>Edge</b></div>
      <div>Distance by road: <b>${e.distance}</b></div>
      <div>Influence weight: <b>${round2(e.weight)}</b></div>
      <div style="margin-top:8px;color:rgba(255,255,255,0.75)">
        Shorter road distance → stronger effect.
      </div>
    `;
            logEvent("info", "graph_edge_selected", { id: e.id, distance: e.distance, weight: round2(e.weight) });
        });

        let distanceMode = false;
        function applyEdgeLengths() {
            if (!distanceMode) return;
            const updates = edgeItems.map((edge) => {
                const length = clamp(60 + edge.distance * 28, 80, 420);
                return { id: edge.id, length };
            });
            network.body.data.edges.update(updates);
        }

        function resetEdgeLengths() {
            const updates = edgeItems.map((edge) => ({ id: edge.id, length: 150 }));
            network.body.data.edges.update(updates);
        }

        function toggleEdgeLengths() {
            distanceMode = !distanceMode;
            if (distanceMode) {
                distanceBtn.classList.add("active");
                distanceBtn.textContent = "📏 Edge lengths: on";
                applyEdgeLengths();
            } else {
                distanceBtn.classList.remove("active");
                distanceBtn.textContent = "📏 Edge lengths";
                resetEdgeLengths();
            }
        }

        distanceBtn.addEventListener("click", toggleEdgeLengths);

        network.on("dragStart", (params) => {
            if (params.nodes?.length) logEvent("info", "graph_drag_start", { id: params.nodes[0] });
        });
        network.on("dragEnd", (params) => {
            if (params.nodes?.length) logEvent("info", "graph_drag_end", { id: params.nodes[0] });
        });
        network.on("zoom", (params) => {
            logEvent("info", "graph_zoom", { scale: round2(params.scale) });
        });
        network.on("stabilizationProgress", (params) => {
            if (params.iterations === 1 || params.iterations % 50 === 0) {
                logEvent("info", "graph_stabilization", { iter: params.iterations, total: params.total });
            }
        });
        network.on("stabilizationIterationsDone", () => {
            logEvent("info", "graph_stabilization_done");
        });

        // Avoid auto-fit/auto-move to prevent unexpected disappearances

        let keepAliveTimer = null;
        const keepAlive = () => {
            if (modal.classList.contains("hidden")) return;
            const rect = cyEl.getBoundingClientRect();
            if (rect.width < 10 || rect.height < 10) return;
            try {
                network.setSize(rect.width, rect.height);
                network.redraw();
            } catch { }
        };
        keepAliveTimer = setInterval(keepAlive, 1500);

        async function onShot() {
            await captureGraphScreenshot(network, "graph");
        }
        shotBtn.addEventListener("click", onShot);

        function close() {
            modal.classList.add("hidden");
            modal.setAttribute("aria-hidden", "true");
            closeBtn.removeEventListener("click", close);
            modal.removeEventListener("click", outside);
            window.removeEventListener("keydown", esc);
            window.removeEventListener("beforeunload", onUnload);
            if (resizeObserver) resizeObserver.disconnect();
            if (keepAliveTimer) clearInterval(keepAliveTimer);
            shotBtn.removeEventListener("click", onShot);
            distanceBtn.removeEventListener("click", toggleEdgeLengths);
            try { network.destroy(); } catch { }
            logEvent("info", "graph_close");
            flushLogs(true);
        }

        function onUnload() {
            logEvent("info", "graph_beforeunload");
            flushLogs(true);
        }

        function outside(e) {
            if (e.target === modal) close();
        }
        function esc(e) {
            if (e.key === "Escape") close();
        }

        closeBtn.addEventListener("click", close);
        modal.addEventListener("click", outside);
        window.addEventListener("keydown", esc);
        window.addEventListener("beforeunload", onUnload);

        let lastSize = { w: 0, h: 0 };
        let resizeObserver = null;
        if ("ResizeObserver" in window) {
            resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    const cr = entry.contentRect;
                    const w = Math.round(cr.width);
                    const h = Math.round(cr.height);
                    if (w !== lastSize.w || h !== lastSize.h) {
                        lastSize = { w, h };
                        logEvent("info", "graph_resize", { w, h });
                        try { network.redraw(); } catch { }
                    }
                    if (w < 10 || h < 10) {
                        logEvent("warn", "graph_container_too_small_runtime", { w, h });
                    }
                }
            });
            resizeObserver.observe(cyEl);
        }

        return network;
    }

    if (!window.vis || !window.vis.Network) {
        info.innerHTML = "Graph engine failed to load. Retrying...";
        import("https://unpkg.com/vis-network@9.1.9/dist/vis-network.esm.min.js")
            .then(mod => initGraph({ Network: mod.Network }))
            .catch(err => {
                logEvent("error", "graph_engine_load_failed", { error: String(err) });
                info.innerHTML = "Graph engine failed to load.";
            });
        return;
    }

    initGraph(window.vis);

    // close handlers are registered in initGraph
}
