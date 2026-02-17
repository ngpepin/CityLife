'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { CityLifeSnapshot } from '@/lib/citylife';

declare global {
  interface Window {
    vis?: {
      Network: new (container: HTMLElement, data: unknown, options: unknown) => any;
    };
  }
}

type GraphNode = {
  id: string;
  name: string;
  category: string;
  active: boolean;
  x: number;
  y: number;
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  distance: number;
  weight: number;
};

const MAX_EDGES_PER_NODE = 4;
const VIS_NETWORK_SCRIPT = 'https://unpkg.com/vis-network@9.1.9/dist/vis-network.min.js';

let visLoadPromise: Promise<void> | null = null;

function loadVisNetwork(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('window unavailable'));
  }
  if (window.vis?.Network) {
    return Promise.resolve();
  }
  if (visLoadPromise) {
    return visLoadPromise;
  }

  visLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${VIS_NETWORK_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load vis-network script')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = VIS_NETWORK_SCRIPT;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load vis-network script'));
    document.head.appendChild(script);
  });

  return visLoadPromise;
}

function categoryColor(category: string): string {
  switch (category) {
    case 'housing':
      return '#7E9BFF';
    case 'work_income':
      return '#E17582';
    case 'work_capacity':
      return '#67D8BE';
    case 'health':
      return '#7CB8E6';
    case 'leisure':
      return '#6BE5A0';
    case 'development':
      return '#9C8CE8';
    default:
      return '#9FB3D9';
  }
}

function categoryLabel(category: string): string {
  return category.replace('_', ' ');
}

function buildGraphData(snapshot: CityLifeSnapshot): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const nodes: GraphNode[] = snapshot.nodes.map((node) => ({
    id: node.id,
    name: node.name,
    category: node.category,
    active: node.active,
    x: node.x,
    y: node.y,
  }));

  const rawEdges: GraphEdge[] = snapshot.edges.map((edge) => ({
    id: `${edge.sourceId}__${edge.targetId}`,
    from: edge.sourceId,
    to: edge.targetId,
    distance: edge.distance,
    weight: edge.weight,
  }));

  const byNode = new Map<string, GraphEdge[]>();
  for (const edge of rawEdges) {
    if (!byNode.has(edge.from)) byNode.set(edge.from, []);
    if (!byNode.has(edge.to)) byNode.set(edge.to, []);
    byNode.get(edge.from)!.push(edge);
    byNode.get(edge.to)!.push(edge);
  }

  const keep = new Set<string>();
  for (const list of byNode.values()) {
    list.sort((a, b) => b.weight - a.weight);
    for (const edge of list.slice(0, MAX_EDGES_PER_NODE)) {
      keep.add(edge.id);
    }
  }

  return {
    nodes,
    edges: rawEdges.filter((edge) => keep.has(edge.id)),
  };
}

function defaultSelectionText(snapshot: CityLifeSnapshot): string {
  if (snapshot.nodes.length === 0) {
    return 'No nodes to display. Build a few structures first.';
  }
  return 'Select a node or edge to inspect relationship details.';
}

export function CityLifeRelationshipGraphModal({
  onClose,
  snapshot,
}: {
  onClose: () => void;
  snapshot: CityLifeSnapshot;
}) {
  const graphRef = useRef<HTMLDivElement | null>(null);
  const networkRef = useRef<any>(null);
  const [distanceMode, setDistanceMode] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState(() => defaultSelectionText(snapshot));
  const [tooltip, setTooltip] = useState<{ visible: boolean; text: string; x: number; y: number }>({
    visible: false,
    text: '',
    x: 0,
    y: 0,
  });
  const [graphError, setGraphError] = useState<string | null>(null);
  const edgeByIdRef = useRef<Map<string, GraphEdge>>(new Map());
  const nodeByIdRef = useRef<Map<string, GraphNode>>(new Map());

  const graphData = useMemo(() => buildGraphData(snapshot), [snapshot]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!graphRef.current) return;

    let cancelled = false;

    const destroyNetwork = () => {
      if (networkRef.current) {
        try {
          networkRef.current.destroy();
        } catch {
          // ignore destroy errors
        }
        networkRef.current = null;
      }
    };

    const init = async () => {
      setGraphError(null);
      await loadVisNetwork();
      if (cancelled || !graphRef.current) return;

      const vis = window.vis;
      if (!vis?.Network) {
        setGraphError('Graph engine unavailable.');
        return;
      }

      destroyNetwork();
      graphRef.current.innerHTML = '';

      nodeByIdRef.current = new Map(graphData.nodes.map((node) => [node.id, node]));
      edgeByIdRef.current = new Map(graphData.edges.map((edge) => [edge.id, edge]));

      const nodeItems = graphData.nodes.map((node, i) => {
        const color = categoryColor(node.category);
        const activeBg = color;
        const inactiveBg = 'rgba(148,163,184,0.34)';
        const angle = (i / Math.max(1, graphData.nodes.length)) * Math.PI * 2;
        return {
          id: node.id,
          label: node.name,
          title: `${node.name} (${node.x}, ${node.y})`,
          x: Math.cos(angle) * 220,
          y: Math.sin(angle) * 220,
          size: node.active ? 16 : 13,
          color: {
            background: node.active ? activeBg : inactiveBg,
            border: node.active ? 'rgba(226,232,240,0.42)' : 'rgba(245,158,11,0.40)',
            highlight: {
              background: activeBg,
              border: 'rgba(191,219,254,0.9)',
            },
            hover: {
              background: activeBg,
              border: 'rgba(191,219,254,0.9)',
            },
          },
          font: {
            color: '#e2e8f0',
            face: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            size: 11,
          },
          shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.55)',
            size: 10,
            x: 0,
            y: 3,
          },
        };
      });

      const edgeItems = graphData.edges.map((edge) => {
        const width = 0.6 + edge.weight * 1.4;
        const opacity = 0.35 + edge.weight * 0.5;
        return {
          id: edge.id,
          from: edge.from,
          to: edge.to,
          width,
          length: 150,
          color: {
            color: `rgba(120,150,210,${opacity})`,
            highlight: 'rgba(160,185,255,0.8)',
            hover: 'rgba(160,185,255,0.7)',
          },
          smooth: { type: 'dynamic', roundness: 0.35 },
          distance: edge.distance,
          weight: edge.weight,
        };
      });

      const network = new vis.Network(
        graphRef.current,
        { nodes: nodeItems, edges: edgeItems },
        {
          autoResize: true,
          layout: {
            improvedLayout: true,
            randomSeed: 2,
          },
          interaction: {
            hover: true,
            multiselect: false,
            dragNodes: true,
            dragView: true,
            zoomView: true,
          },
          nodes: {
            shape: 'dot',
            scaling: { min: 10, max: 18 },
            shadow: true,
          },
          edges: {
            smooth: { type: 'dynamic' },
            selectionWidth: 1.6,
            hoverWidth: 1.4,
            shadow: false,
          },
          physics: {
            enabled: true,
            solver: 'forceAtlas2Based',
            stabilization: { enabled: true, iterations: 300, updateInterval: 25, fit: false },
            forceAtlas2Based: {
              gravitationalConstant: -45,
              centralGravity: 0.02,
              springLength: 150,
              springConstant: 0.07,
              damping: 0.35,
              avoidOverlap: 0.8,
            },
            maxVelocity: 40,
            minVelocity: 0.02,
            timestep: 0.5,
            adaptiveTimestep: true,
          },
        },
      );

      networkRef.current = network;

      network.on('hoverNode', (params: any) => {
        const node = nodeByIdRef.current.get(params.node);
        setTooltip({
          visible: true,
          text: node ? `${node.name} (${node.x}, ${node.y})` : params.node,
          x: params.pointer.DOM.x + 12,
          y: params.pointer.DOM.y - 8,
        });
      });

      network.on('blurNode', () => {
        setTooltip((prev) => ({ ...prev, visible: false }));
      });

      network.on('hoverEdge', (params: any) => {
        const edge = edgeByIdRef.current.get(params.edge);
        const text = edge
          ? `distance=${edge.distance}, weight=${edge.weight.toFixed(2)}`
          : String(params.edge);
        setTooltip({
          visible: true,
          text,
          x: params.pointer.DOM.x + 12,
          y: params.pointer.DOM.y - 8,
        });
      });

      network.on('blurEdge', () => {
        setTooltip((prev) => ({ ...prev, visible: false }));
      });

      network.on('mousemove', (params: any) => {
        setTooltip((prev) => {
          if (!prev.visible) return prev;
          return {
            ...prev,
            x: params.pointer.DOM.x + 12,
            y: params.pointer.DOM.y - 8,
          };
        });
      });

      network.on('selectNode', (params: any) => {
        const node = nodeByIdRef.current.get(params.nodes[0]);
        if (!node) return;
        setSelectedInfo(
          `${node.name}\nActive: ${node.active ? 'Yes' : 'No (needs road)'}\nCategory: ${categoryLabel(node.category)}\nTile: (${node.x}, ${node.y})`,
        );
      });

      network.on('selectEdge', (params: any) => {
        const edge = edgeByIdRef.current.get(params.edges[0]);
        if (!edge) return;
        setSelectedInfo(
          `Edge\nRoad distance: ${edge.distance}\nInfluence weight: ${edge.weight.toFixed(2)}\nShorter road distance means stronger effect.`,
        );
      });
    };

    init().catch((error) => {
      if (!cancelled) {
        setGraphError(String(error));
      }
    });

    return () => {
      cancelled = true;
      if (networkRef.current) {
        try {
          networkRef.current.destroy();
        } catch {
          // ignore destroy errors
        }
        networkRef.current = null;
      }
    };
  }, [graphData]);

  useEffect(() => {
    if (!networkRef.current) return;
    const edgesDataSet = networkRef.current.body?.data?.edges;
    if (!edgesDataSet || typeof edgesDataSet.update !== 'function') return;

    const updates = graphData.edges.map((edge) => {
      const length = distanceMode ? Math.max(80, Math.min(420, 60 + edge.distance * 28)) : 150;
      return { id: edge.id, length };
    });
    edgesDataSet.update(updates);
  }, [distanceMode, graphData.edges]);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-3 md:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative h-[min(780px,96vh)] w-[min(1240px,98vw)] overflow-hidden rounded-lg border border-white/15 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/85 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-white">Relationship Graph</div>
            <div className="text-xs text-slate-400">Obsidian-style network of active and inactive CityLife nodes</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDistanceMode((prev) => !prev)}
              className={`rounded border px-2 py-1 text-xs ${
                distanceMode
                  ? 'border-cyan-300/70 bg-cyan-400/20 text-cyan-100'
                  : 'border-white/20 bg-white/5 text-slate-300'
              }`}
            >
              {distanceMode ? 'Edge lengths: on' : 'Edge lengths'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-white/20 bg-white/5 px-2 py-1 text-xs text-slate-300 hover:border-white/40 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>

        <div className="grid h-[calc(100%-57px)] grid-cols-1 md:grid-cols-[1fr_290px]">
          <div className="relative h-full border-b border-white/10 bg-[#0a1020] md:border-b-0 md:border-r">
            <div ref={graphRef} className="h-full w-full" />
            {tooltip.visible && (
              <div
                className="pointer-events-none absolute max-w-[280px] rounded border border-white/20 bg-slate-950/95 px-2 py-1 text-xs text-slate-200"
                style={{ left: tooltip.x, top: tooltip.y }}
              >
                {tooltip.text}
              </div>
            )}
            {graphError && (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-rose-200">
                {graphError}
              </div>
            )}
          </div>

          <aside className="h-full overflow-y-auto bg-slate-900/70 p-3 text-xs text-slate-300">
            <div className="mb-3 rounded border border-white/10 bg-slate-950/50 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Snapshot</div>
              <div>Income: {snapshot.income.toFixed(1)}</div>
              <div>Happiness: {snapshot.happiness.toFixed(1)}</div>
              <div>Wellness: {snapshot.wellness.toFixed(1)}</div>
              <div>
                Active: {snapshot.activeNodes}/{snapshot.totalNodes}
              </div>
              <div>Edges: {graphData.edges.length}</div>
            </div>

            <div className="mb-3 rounded border border-white/10 bg-slate-950/50 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Selected</div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-5 text-slate-200">{selectedInfo}</pre>
            </div>

            <div className="rounded border border-white/10 bg-slate-950/50 p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Legend</div>
              <ul className="space-y-1">
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#7E9BFF]" />
                  housing
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#E17582]" />
                  work income
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#67D8BE]" />
                  work capacity
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#7CB8E6]" />
                  health
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#6BE5A0]" />
                  leisure
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#9C8CE8]" />
                  development
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-500" />
                  inactive nodes
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
