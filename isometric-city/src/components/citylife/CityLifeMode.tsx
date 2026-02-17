'use client';

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { CanvasIsometricGrid } from '@/components/game/CanvasIsometricGrid';
import { OverlayMode } from '@/components/game/types';
import { useGame } from '@/context/GameContext';
import {
  CITYLIFE_SPRITE_PACK_ID,
  CITYLIFE_TOOLS,
  CityLifeTool,
  calculateCityLifeSnapshot,
  createCityLifeStarterState,
} from '@/lib/citylife';
import { Tool } from '@/types/game';

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="rounded-md border border-white/10 bg-slate-900/85 px-3 py-2 backdrop-blur-sm">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-300">
        <span>{label}</span>
        <span className="font-semibold text-white">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function ToolButton({
  tool,
  selected,
  onSelect,
}: {
  tool: CityLifeTool;
  selected: boolean;
  onSelect: (tool: Tool) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tool.tool)}
      className={`w-full rounded-md border px-3 py-2 text-left transition ${
        selected
          ? 'border-cyan-300/70 bg-cyan-400/15 text-white'
          : 'border-white/10 bg-slate-900/70 text-slate-200 hover:border-white/25 hover:bg-slate-800/80'
      }`}
    >
      <div className="text-sm font-medium">{tool.label}</div>
      <div className="text-xs text-slate-400">{tool.description}</div>
    </button>
  );
}

export function CityLifeMode() {
  const { state, setTool, loadState, setSpritePack, currentSpritePack } = useGame();
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const initRef = useRef(false);
  const overlayMode: OverlayMode = 'none';

  const resetToStarterCity = useCallback(() => {
    const starter = createCityLifeStarterState(40);
    const ok = loadState(JSON.stringify(starter));
    if (!ok) {
      console.error('Failed to load CityLife starter state');
    }
    setSelectedTile(null);
  }, [loadState]);

  useEffect(() => {
    const previousPackId = currentSpritePack.id;
    if (previousPackId !== CITYLIFE_SPRITE_PACK_ID) {
      setSpritePack(CITYLIFE_SPRITE_PACK_ID);
    }
    return () => {
      if (previousPackId !== CITYLIFE_SPRITE_PACK_ID) {
        setSpritePack(previousPackId);
      }
    };
  }, [setSpritePack]); // Intentionally run once per CityLife mount

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    resetToStarterCity();
  }, [resetToStarterCity]);

  const snapshot = useMemo(
    () => calculateCityLifeSnapshot(state.grid, state.gridSize),
    [state.grid, state.gridSize],
  );

  const selectedNode = useMemo(() => {
    if (!selectedTile) return null;
    return snapshot.nodes.find((node) => node.x === selectedTile.x && node.y === selectedTile.y) ?? null;
  }, [selectedTile, snapshot.nodes]);

  const topEdges = snapshot.edges.slice(0, 6);
  const actionTools = CITYLIFE_TOOLS.filter((tool) => tool.section === 'actions');
  const buildTools = CITYLIFE_TOOLS.filter((tool) => tool.section === 'build');

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 md:flex">
      <aside className="w-full shrink-0 border-b border-white/10 bg-slate-950/95 p-4 md:h-full md:w-80 md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">CityLife</h1>
            <p className="text-xs text-slate-400">Life-planning mode on the IsoCity engine</p>
          </div>
          <Link
            href="/"
            className="rounded border border-white/20 px-2 py-1 text-xs text-slate-300 hover:border-white/40 hover:text-white"
          >
            IsoCity
          </Link>
        </div>

        <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Tools</div>
        <div className="mb-2 grid grid-cols-1 gap-2">
          {actionTools.map((tool) => (
            <ToolButton
              key={tool.tool}
              tool={tool}
              selected={state.selectedTool === tool.tool}
              onSelect={setTool}
            />
          ))}
        </div>
        <div className="mb-2 grid grid-cols-1 gap-2">
          {buildTools.map((tool) => (
            <ToolButton
              key={tool.tool}
              tool={tool}
              selected={state.selectedTool === tool.tool}
              onSelect={setTool}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            resetToStarterCity();
          }}
          className="mt-2 w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
        >
          Reset City
        </button>

        <div className="mt-6 rounded-md border border-white/10 bg-slate-900/70 p-3">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Concept Rules</div>
          <ul className="mt-2 space-y-1 text-xs text-slate-300">
            <li>Buildings are active only when orthogonally adjacent to roads.</li>
            <li>Influence uses shortest road-path distance with exponential decay.</li>
            <li>Balance income with happiness and wellness for sustainability.</li>
          </ul>
        </div>

        {selectedNode && (
          <div className="mt-4 rounded-md border border-white/10 bg-slate-900/70 p-3 text-xs">
            <div className="mb-1 font-semibold text-white">{selectedNode.name}</div>
            <div className="text-slate-400">
              {selectedNode.category.replace('_', ' ')} at ({selectedNode.x}, {selectedNode.y})
            </div>
            <div className={`mt-1 font-medium ${selectedNode.active ? 'text-emerald-300' : 'text-amber-300'}`}>
              {selectedNode.active ? 'Active (road-connected)' : 'Inactive (needs road)'}
            </div>
          </div>
        )}
      </aside>

      <section className="relative min-h-0 flex-1">
        <div className="pointer-events-none absolute left-3 right-3 top-3 z-20 grid grid-cols-1 gap-2 md:grid-cols-3">
          <MetricCard label="Income" value={snapshot.income} color="bg-cyan-400" />
          <MetricCard label="Happiness" value={snapshot.happiness} color="bg-emerald-400" />
          <MetricCard label="Wellness" value={snapshot.wellness} color="bg-indigo-400" />
        </div>

        <div className="pointer-events-none absolute bottom-3 right-3 z-20 w-[min(360px,92vw)] rounded-md border border-white/10 bg-slate-950/85 p-3 text-xs backdrop-blur-sm">
          <div className="mb-1 flex items-center justify-between text-slate-300">
            <span className="font-semibold text-white">Influence Summary</span>
            <span>
              Active {snapshot.activeNodes}/{snapshot.totalNodes}
            </span>
          </div>
          {topEdges.length === 0 ? (
            <div className="text-slate-400">Connect buildings with roads to generate influence edges.</div>
          ) : (
            <div className="space-y-1 text-slate-300">
              {topEdges.map((edge) => {
                const a = snapshot.nodes.find((node) => node.id === edge.sourceId);
                const b = snapshot.nodes.find((node) => node.id === edge.targetId);
                return (
                  <div key={`${edge.sourceId}-${edge.targetId}`} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {(a?.name ?? 'Node')} <span className="text-slate-500">↔</span> {(b?.name ?? 'Node')}
                    </span>
                    <span className="shrink-0 text-slate-400">
                      d={edge.distance} w={edge.weight.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="absolute inset-0">
          <CanvasIsometricGrid
            overlayMode={overlayMode}
            selectedTile={selectedTile}
            setSelectedTile={setSelectedTile}
          />
        </div>
      </section>
    </div>
  );
}
