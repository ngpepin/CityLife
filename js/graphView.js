import { CONFIG } from "./config.js";
import { expFalloff, round2, clamp } from "./utils.js";

export function openGraphModal(state, roadGraph, metrics) {
    const modal = document.getElementById("graphModal");
    const closeBtn = document.getElementById("closeGraph");
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

    // node styling by category
    function nodeStyle(type) {
        if (type === "house") return { bg: "#6EA6FF" };
        if (type === "office") return { bg: "#42E6B0" };
        if (type === "factory") return { bg: "#FF6B7D" };
        if (type === "park") return { bg: "#4CFF95" };
        if (type === "mall") return { bg: "#FFD06A" };
        if (type === "hospital") return { bg: "#69E9FF" };
        if (type === "school") return { bg: "#B79CFF" };
        return { bg: "#BFD3FF" };
    }

    const nodes = buildings.map(b => {
        const st = nodeStyle(b.type);
        return {
            data: {
                id: b.id,
                type: b.type,
                tooltip: b.id,     // requested: internal id on hover
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

            const d = roadGraph.roadDistanceBetweenBuildings(A, B, CONFIG.maxUsefulDistance);
            if (!Number.isFinite(d)) continue;

            const w = expFalloff(d, CONFIG.influenceFalloff);
            if (w < CONFIG.influenceThreshold) continue;

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

    const cy = cytoscape({
        container: cyEl,
        elements: { nodes, edges: edgesFiltered },
        layout: {
            name: "cose",
            animate: true,
            randomize: false,
            idealEdgeLength: 220,
            nodeRepulsion: 14000,
            nodeOverlap: 10,
            gravity: 0.12,
            numIter: 1200,
            coolingFactor: 0.98
        },
        style: [
            {
                selector: "node",
                style: {
                    "width": 18,
                    "height": 18,
                    "background-color": "data(bg)",
                    "border-width": 1,
                    "border-color": "rgba(255,255,255,0.20)",
                    "shadow-blur": 12,
                    "shadow-color": "rgba(120,140,255,0.18)",
                    "shadow-opacity": 0.9,
                    "shadow-offset-y": 4,

                    // Hide labels by default (Obsidian vibe)
                    "label": "",
                    "text-valign": "center",
                    "text-halign": "center",
                    "font-size": 12,
                    "color": "rgba(255,255,255,0.85)",
                    "text-background-color": "rgba(0,0,0,0.55)",
                    "text-background-opacity": 1,
                    "text-background-padding": 4,
                    "text-background-shape": "round-rectangle"
                }
            },

            // emoji overlay using "background-image" is messy; keep emoji as label on hover/selection:
            {
                selector: "node",
                style: {
                    "width": 14,
                    "height": 14,
                    "shape": "ellipse",
                    "background-color": "data(bg)",
                    "border-width": 1,
                    "border-color": "rgba(255,255,255,0.22)",

                    // depth
                    "shadow-blur": 18,
                    "shadow-color": "rgba(0,0,0,0.35)",
                    "shadow-opacity": 0.9,
                    "shadow-offset-y": 6,

                    // no label; we'll use tooltip overlay
                    "label": "",
                    "overlay-opacity": 0,
                }
            },
            {
                selector: "node:hover",
                style: {
                    "width": 20,
                    "height": 20,
                    "border-width": 2,
                    "border-color": "rgba(120,140,255,0.85)",
                    "shadow-color": "rgba(120,140,255,0.28)"
                }
            },
            {
                selector: "node:selected",
                style: {
                    "width": 22,
                    "height": 22,
                    "border-width": 2,
                    "border-color": "rgba(53,255,154,0.90)",
                    "shadow-color": "rgba(53,255,154,0.22)"
                }
            },
            {
                selector: "node.inactive",
                style: {
                    "opacity": 0.30,
                    "border-color": "rgba(255,180,120,0.40)"
                }
            },

            {
                selector: "edge",
                style: {
                    "width": "mapData(weight, 0.08, 1.0, 0.35, 1.6)",
                    "line-color": "rgba(120,140,255,0.28)",
                    "opacity": 0.55,
                    "curve-style": "bezier",
                    "control-point-step-size": 30,
                    "line-cap": "round"
                }
            },
            {
                selector: "edge:hover",
                style: { "opacity": 0.9, "line-color": "rgba(120,140,255,0.55)" }
            },
            {
                selector: "edge:selected",
                style: { "opacity": 1, "line-color": "rgba(53,255,154,0.85)", "width": 2.2 }
            }
        ]

    });

    const tip = document.getElementById("graphTooltip");

    cy.on("mouseover", "node", (evt) => {
        const n = evt.target;
        tip.textContent = n.data("tooltip");
        tip.classList.remove("hidden");
    });
    cy.on("mouseout", "node", () => {
        tip.classList.add("hidden");
    });

    cy.on("mousemove", "node", (evt) => {
        const pos = evt.renderedPosition;
        // container-relative positioning
        tip.style.left = `${pos.x}px`;
        tip.style.top = `${pos.y}px`;
    });

    cy.on("tap", "node", (evt) => {
        const n = evt.target.data();
        info.innerHTML = `
    <div><b>${n.label} ${n.name}</b></div>
    <div>Active: <b>${n.active ? "Yes" : "No (needs road)"}</b></div>
    <div style="margin-top:8px;color:rgba(255,255,255,0.75)">
      Move this building closer/farther to rebalance influence.
    </div>
  `;
    });

    cy.on("tap", "edge", (evt) => {
        const e = evt.target.data();
        info.innerHTML = `
      <div><b>Edge</b></div>
      <div>Distance by road: <b>${e.distance}</b></div>
      <div>Influence weight: <b>${round2(e.weight)}</b></div>
      <div style="margin-top:8px;color:rgba(255,255,255,0.75)">
        Shorter road distance → stronger effect.
      </div>
    `;
    });

    // Jiggle: gently reheat layout when user drags a node
    let jiggleTimer = null;
    cy.on("dragfree", "node", () => {
        if (jiggleTimer) clearTimeout(jiggleTimer);

        const layout = cy.layout({
            name: "cose",
            animate: true,
            randomize: false,
            idealEdgeLength: 180,
            nodeRepulsion: 12000,
            gravity: 0.10,
            numIter: 350,
            coolingFactor: 0.99
        });

        layout.run();

        // stop it after a moment so it settles
        jiggleTimer = setTimeout(() => {
            try { layout.stop(); } catch { }
        }, 650);
    });

    function close() {
        modal.classList.add("hidden");
        modal.setAttribute("aria-hidden", "true");
        closeBtn.removeEventListener("click", close);
        modal.removeEventListener("click", outside);
        window.removeEventListener("keydown", esc);
        // Cytoscape GC hint
        try { cy.destroy(); } catch { }
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
}
