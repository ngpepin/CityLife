'use client';

import React, {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Link from 'next/link';
import { CanvasIsometricGrid } from '@/components/game/CanvasIsometricGrid';
import { OverlayMode } from '@/components/game/types';
import { CityLifeInsightsPanel } from '@/components/citylife/CityLifeInsightsPanel';
import { CityLifeNodeEditor } from '@/components/citylife/CityLifeNodeEditor';
import { CityLifeOnboarding } from '@/components/citylife/CityLifeOnboarding';
import { CityLifeRelationshipGraphModal } from '@/components/citylife/CityLifeRelationshipGraphModal';
import { useGame } from '@/context/GameContext';
import { useMobile } from '@/hooks/useMobile';
import {
  CITYLIFE_TOOLS,
  CityLifeNode,
  CityLifeTool,
  calculateCityLifeSnapshot,
  createBlankCityLifeState,
  createCityLifeStarterState,
  moveCityLifeNode,
  updateCityLifeNodeMetadata,
} from '@/lib/citylife';
import {
  loadCityLifeWorkspace,
  parseCityLifeWorkspace,
  saveCityLifeWorkspace,
  serializeCityLifeWorkspace,
} from '@/lib/citylifeStorage';
import { GameState, Tool } from '@/types/game';

type InteractionTool = Tool | 'move';
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
type Notice = { tone: 'info' | 'success' | 'error'; message: string };

type PendingCapture = {
  title: string;
  beforeNodeIds: string[];
};

type WorkspaceActivation = {
  id: string;
  saveStatus: SaveStatus;
  closeOnboarding: boolean;
};

const CAPTURE_OPTIONS: Array<{ tool: Tool; label: string }> = [
  { tool: 'house_small', label: 'Life foundation' },
  { tool: 'factory_small', label: 'Current work' },
  { tool: 'office_building_small', label: 'Future work' },
  { tool: 'hospital', label: 'Health' },
  { tool: 'park', label: 'Rest / leisure' },
  { tool: 'school', label: 'Learning' },
  { tool: 'shop_medium', label: 'Social / errands' },
];

function signed(value: number): string {
  if (Math.abs(value) < 0.005) return '0.00';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

function MetricCard({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone: 'cyan' | 'emerald' | 'indigo';
  onClick: () => void;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const styles = {
    cyan: {
      border: 'hover:border-cyan-300/35',
      wash: 'from-cyan-400/[0.11]',
      text: 'text-cyan-200',
      bar: 'from-cyan-400 to-sky-300',
      shadow: 'shadow-cyan-950/30',
    },
    emerald: {
      border: 'hover:border-emerald-300/35',
      wash: 'from-emerald-400/[0.11]',
      text: 'text-emerald-200',
      bar: 'from-emerald-400 to-teal-300',
      shadow: 'shadow-emerald-950/30',
    },
    indigo: {
      border: 'hover:border-indigo-300/35',
      wash: 'from-indigo-400/[0.13]',
      text: 'text-indigo-200',
      bar: 'from-indigo-400 to-violet-300',
      shadow: 'shadow-indigo-950/30',
    },
  }[tone];
  return (
    <button
      type="button"
      className={`pointer-events-auto group relative overflow-hidden rounded-lg border border-white/10 bg-slate-950/85 px-2.5 py-2 text-left shadow-lg ${styles.shadow} backdrop-blur-md transition duration-200 ${styles.border} hover:-translate-y-0.5 hover:bg-slate-900/95 focus:outline-none focus:ring-2 focus:ring-cyan-300/60 sm:rounded-xl sm:px-3.5 sm:py-2.5`}
      onClick={onClick}
    >
      <span className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles.wash} via-transparent to-transparent`} />
      <div className="relative mb-1.5 flex items-center justify-between gap-2 text-[10px] text-slate-300 sm:text-xs">
        <span className="truncate font-medium tracking-wide">{label}</span>
        <span className={`font-mono text-xs font-semibold ${styles.text} sm:text-sm`}>{value.toFixed(1)}</span>
      </div>
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10 ring-1 ring-inset ring-white/5"
        role="progressbar"
        aria-label={`${label} score`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(value.toFixed(1))}
      >
        <div className={`h-full rounded-full bg-gradient-to-r ${styles.bar} shadow-[0_0_10px_currentColor]`} style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
      <span>{children}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
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
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative min-h-11 overflow-hidden rounded-lg border px-2.5 py-2 text-left transition duration-200 hover:-translate-y-px ${
        selected
          ? 'border-cyan-300/60 bg-gradient-to-br from-cyan-400/20 to-sky-400/5 text-white shadow-[0_8px_24px_rgba(8,145,178,0.12)]'
          : 'border-white/[0.09] bg-white/[0.035] text-slate-200 hover:border-white/20 hover:bg-white/[0.07]'
      }`}
    >
      {selected && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-0.5 rounded-r-full bg-cyan-300" />}
      <div className="text-xs font-medium tracking-wide sm:text-sm">{tool.label}</div>
      <div className="mt-1 hidden text-[10px] leading-snug text-slate-500 transition group-hover:text-slate-400 lg:block">{tool.description}</div>
    </button>
  );
}

function ActionButton({
  label,
  selected = false,
  danger = false,
  disabled = false,
  onClick,
}: {
  label: string;
  selected?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`min-h-11 rounded-lg border px-2.5 py-2 text-xs font-medium tracking-wide transition duration-200 enabled:hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-35 sm:text-sm ${
        selected
          ? 'border-cyan-300/60 bg-gradient-to-br from-cyan-400/20 to-sky-400/5 text-white shadow-[0_8px_24px_rgba(8,145,178,0.12)]'
          : danger
            ? 'border-rose-300/15 bg-rose-400/[0.04] text-rose-200 hover:border-rose-300/35 hover:bg-rose-400/10'
            : 'border-white/[0.09] bg-white/[0.035] text-slate-200 hover:border-white/20 hover:bg-white/[0.07]'
      }`}
    >
      {label}
    </button>
  );
}

function nodeReadiness(node: CityLifeNode): { label: string; className: string } {
  if (!node.active) {
    return { label: 'Needs an adjacent road', className: 'text-amber-300' };
  }
  if (node.relationshipCount === 0) {
    return { label: 'Road active, but isolated', className: 'text-sky-300' };
  }
  return {
    label: `Connected to ${node.relationshipCount} relationship${node.relationshipCount === 1 ? '' : 's'}`,
    className: 'text-emerald-300',
  };
}

export function CityLifeMode() {
  const {
    gameMode,
    state,
    latestStateRef,
    updateGameState,
    setTool,
    loadState,
    isStateReady,
  } = useGame();
  const { isMobileDevice, isSmallScreen } = useMobile();
  const isMobileCanvas = isMobileDevice || isSmallScreen;
  const [selectedTile, setSelectedTile] = useState<{ x: number; y: number } | null>(null);
  const [activeTool, setActiveTool] = useState<InteractionTool>('select');
  const [moveSource, setMoveSource] = useState<{ x: number; y: number } | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [graphOpen, setGraphOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [workspaceActivation, setWorkspaceActivation] = useState<WorkspaceActivation | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureTool, setCaptureTool] = useState<Tool>('factory_small');
  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const hydrationStartedRef = useRef(false);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const previousGridStateRef = useRef<GameState | null>(null);
  const undoStateRef = useRef<string | null>(null);
  const skipNextHistoryRef = useRef(true);
  const historyInitializationIdRef = useRef<string | null>(null);
  const overlayMode: OverlayMode = 'none';
  const workspaceReady = workspaceActivation !== null
    && state.id === workspaceActivation.id
    && state.gameMode === 'citylife';

  const snapshot = useMemo(
    () => calculateCityLifeSnapshot(state.grid, state.gridSize),
    [state.grid, state.gridSize],
  );

  const selectedNode = useMemo(() => {
    if (!selectedTile) return null;
    return snapshot.nodes.find((node) => node.x === selectedTile.x && node.y === selectedTile.y) ?? null;
  }, [selectedTile, snapshot.nodes]);

  const editingNode = useMemo(
    () => snapshot.nodes.find((node) => node.id === editingNodeId) ?? null,
    [editingNodeId, snapshot.nodes],
  );

  const topEdges = snapshot.edges.slice(0, 6);
  const actionTools = CITYLIFE_TOOLS.filter((tool) => tool.section === 'actions');
  const buildTools = CITYLIFE_TOOLS.filter((tool) => tool.section === 'build');

  const showNotice = useCallback((nextNotice: Notice) => {
    setNotice(nextNotice);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!isStateReady || hydrationStartedRef.current) return;
    hydrationStartedRef.current = true;

    let cancelled = false;
    window.queueMicrotask(() => {
      if (cancelled) return;
      const stored = loadCityLifeWorkspace();
      if (stored?.ok) {
        historyInitializationIdRef.current = stored.state.id;
        const loaded = loadState(JSON.stringify(stored.state));
        if (loaded) {
          setTool('select');
          setWorkspaceActivation({
            id: stored.state.id,
            saveStatus: 'saved',
            closeOnboarding: false,
          });
          skipNextHistoryRef.current = true;
          return;
        }
        historyInitializationIdRef.current = null;
      }

      if (stored && !stored.ok) {
        showNotice({
          tone: 'error',
          message: `The saved plan could not be loaded: ${stored.error}`,
        });
      }

      loadState(JSON.stringify(createBlankCityLifeState(40)));
      setOnboardingOpen(true);
    });

    return () => {
      cancelled = true;
    };
  }, [isStateReady, loadState, setTool, showNotice]);

  useEffect(() => {
    if (!workspaceReady || !workspaceActivation) return;

    window.queueMicrotask(() => {
      setSaveStatus(workspaceActivation.saveStatus);
      if (workspaceActivation.closeOnboarding) setOnboardingOpen(false);
    });
  }, [workspaceActivation, workspaceReady]);

  const startWorkspace = useCallback(
    (nextState: GameState) => {
      historyInitializationIdRef.current = nextState.id;
      skipNextHistoryRef.current = true;
      previousGridStateRef.current = null;
      undoStateRef.current = null;
      setCanUndo(false);
      const loaded = loadState(JSON.stringify(nextState));
      if (!loaded) {
        historyInitializationIdRef.current = null;
        showNotice({ tone: 'error', message: 'The new CityLife plan could not be initialized.' });
        return;
      }
      setWorkspaceActivation({
        id: nextState.id,
        saveStatus: 'saving',
        closeOnboarding: true,
      });
      setSelectedTile(null);
      setMoveSource(null);
      setActiveTool('select');
      setTool('select');
    },
    [loadState, setTool, showNotice],
  );

  useEffect(() => {
    if (!workspaceReady || gameMode !== 'citylife') return;
    const currentState = latestStateRef.current;
    const initializationId = historyInitializationIdRef.current;
    if (initializationId) {
      if (currentState.id !== initializationId) return;
      historyInitializationIdRef.current = null;
      previousGridStateRef.current = currentState;
      undoStateRef.current = null;
      skipNextHistoryRef.current = false;
      window.queueMicrotask(() => setCanUndo(false));
      return;
    }
    if (!previousGridStateRef.current || skipNextHistoryRef.current) {
      previousGridStateRef.current = currentState;
      skipNextHistoryRef.current = false;
      return;
    }

    undoStateRef.current = JSON.stringify(previousGridStateRef.current);
    previousGridStateRef.current = currentState;
    window.queueMicrotask(() => setCanUndo(true));
  }, [gameMode, latestStateRef, state.grid, workspaceReady]);

  useEffect(() => {
    if (!workspaceReady || onboardingOpen || gameMode !== 'citylife') return;
    window.queueMicrotask(() => setSaveStatus('saving'));
    const timeout = window.setTimeout(() => {
      const result = saveCityLifeWorkspace(latestStateRef.current);
      setSaveStatus(result.ok ? 'saved' : 'error');
      if (!result.ok) {
        showNotice({ tone: 'error', message: `Autosave failed: ${result.error}` });
      }
    }, 650);
    return () => window.clearTimeout(timeout);
  }, [gameMode, latestStateRef, onboardingOpen, showNotice, state.grid, workspaceReady]);

  useEffect(() => {
    if (!workspaceReady) return;
    const saveBeforeLeaving = () => {
      const latest = latestStateRef.current;
      if (latest.gameMode === 'citylife') saveCityLifeWorkspace(latest);
    };
    window.addEventListener('beforeunload', saveBeforeLeaving);
    return () => window.removeEventListener('beforeunload', saveBeforeLeaving);
  }, [latestStateRef, workspaceReady]);

  useEffect(() => {
    if (!pendingCapture) return;
    const createdNode = snapshot.nodes.find((node) => !pendingCapture.beforeNodeIds.includes(node.id));
    if (!createdNode) return;

    let cancelled = false;
    window.queueMicrotask(() => {
      if (cancelled) return;
      setPendingCapture(null);
      // Treat placement plus its initial title/metadata as one undoable capture.
      skipNextHistoryRef.current = true;
      updateGameState((current) =>
        updateCityLifeNodeMetadata(current, createdNode.id, {
          ...createdNode.metadata,
          title: pendingCapture.title,
          status: 'backlog',
          updatedAt: Date.now(),
        }),
      );
      setSelectedTile({ x: createdNode.x, y: createdNode.y });
      setEditingNodeId(createdNode.id);
      setCaptureTitle('');
      setActiveTool('select');
      setTool('select');
      showNotice({ tone: 'success', message: 'Activity placed. Add its next action and details.' });
    });

    return () => {
      cancelled = true;
    };
  }, [pendingCapture, setTool, showNotice, snapshot.nodes, updateGameState]);

  const selectInteractionTool = useCallback(
    (tool: InteractionTool) => {
      setPendingCapture(null);
      setMoveSource(null);
      setActiveTool(tool);
      setTool(tool === 'move' ? 'select' : tool);
      if (tool !== 'select' && tool !== 'move') setSelectedTile(null);
    },
    [setTool],
  );

  const handleCanvasSelection = useCallback(
    (tile: { x: number; y: number } | null) => {
      if (!tile) {
        setSelectedTile(null);
        return;
      }

      if (activeTool !== 'move') {
        setSelectedTile(tile);
        return;
      }

      if (!moveSource) {
        const node = snapshot.nodes.find((candidate) => candidate.x === tile.x && candidate.y === tile.y);
        if (!node) {
          showNotice({ tone: 'info', message: 'Choose an activity building first.' });
          return;
        }
        setMoveSource({ x: node.x, y: node.y });
        setSelectedTile({ x: node.x, y: node.y });
        showNotice({ tone: 'info', message: `Now choose an empty land tile for “${node.name}”.` });
        return;
      }

      const result = moveCityLifeNode(latestStateRef.current, moveSource, tile);
      if (!result.ok) {
        showNotice({ tone: 'error', message: result.reason });
        return;
      }

      updateGameState(() => result.state);
      setMoveSource(null);
      setSelectedTile(tile);
      setActiveTool('select');
      setTool('select');
      showNotice({ tone: 'success', message: 'Activity moved; relationships and scores were recalculated.' });
    },
    [activeTool, latestStateRef, moveSource, setTool, showNotice, snapshot.nodes, updateGameState],
  );

  const beginMoveForNode = useCallback(
    (node: CityLifeNode) => {
      setPendingCapture(null);
      setActiveTool('move');
      setTool('select');
      setMoveSource({ x: node.x, y: node.y });
      setSelectedTile({ x: node.x, y: node.y });
      showNotice({ tone: 'info', message: `Choose an empty land tile for “${node.name}”.` });
    },
    [setTool, showNotice],
  );

  const beginCapture = useCallback(() => {
    const title = captureTitle.trim();
    if (!title) {
      showNotice({ tone: 'info', message: 'Name the activity before placing it.' });
      return;
    }
    setPendingCapture({ title, beforeNodeIds: snapshot.nodes.map((node) => node.id) });
    setMoveSource(null);
    setActiveTool(captureTool);
    setTool(captureTool);
    setMobileToolsOpen(false);
    showNotice({ tone: 'info', message: `Click an empty land tile to place “${title}”.` });
  }, [captureTitle, captureTool, setTool, showNotice, snapshot.nodes]);

  const handleUndo = useCallback(() => {
    if (!undoStateRef.current) return;
    let restoredId: string | null = null;
    try {
      const candidate = JSON.parse(undoStateRef.current) as { id?: unknown };
      restoredId = typeof candidate.id === 'string' ? candidate.id : null;
    } catch {
      restoredId = null;
    }
    if (!restoredId) {
      showNotice({ tone: 'error', message: 'The previous plan state is invalid and could not be restored.' });
      return;
    }
    skipNextHistoryRef.current = true;
    const restored = loadState(undoStateRef.current);
    if (!restored) {
      showNotice({ tone: 'error', message: 'The previous plan state could not be restored.' });
      return;
    }
    previousGridStateRef.current = null;
    undoStateRef.current = null;
    setCanUndo(false);
    setWorkspaceActivation({
      id: restoredId,
      saveStatus: 'saving',
      closeOnboarding: true,
    });
    setSelectedTile(null);
    setMoveSource(null);
    setEditingNodeId(null);
    setActiveTool('select');
    setTool('select');
    showNotice({ tone: 'success', message: 'Last plan change undone.' });
  }, [loadState, setTool, showNotice]);

  const exportWorkspace = useCallback(() => {
    try {
      const latest = latestStateRef.current;
      const localSave = saveCityLifeWorkspace(latest);
      const blob = new Blob([serializeCityLifeWorkspace(latest)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `citylife-plan-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setSaveStatus(localSave.ok ? 'saved' : 'error');
      showNotice(localSave.ok
        ? { tone: 'success', message: 'Plan exported as JSON.' }
        : { tone: 'error', message: `Plan exported, but local save failed: ${localSave.error}` });
    } catch {
      showNotice({ tone: 'error', message: 'The plan could not be exported.' });
    }
  }, [latestStateRef, showNotice]);

  const importWorkspace = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      if (file.size > 15 * 1024 * 1024) {
        showNotice({ tone: 'error', message: 'That file is too large to be a CityLife plan.' });
        return;
      }

      try {
        const parsed = parseCityLifeWorkspace(await file.text());
        if (!parsed.ok) {
          showNotice({ tone: 'error', message: `Import failed: ${parsed.error}` });
          return;
        }
        if (!workspaceReady) {
          historyInitializationIdRef.current = parsed.state.id;
        }
        const loaded = loadState(JSON.stringify(parsed.state));
        if (!loaded) {
          if (!workspaceReady) {
            historyInitializationIdRef.current = null;
          }
          showNotice({ tone: 'error', message: 'Import failed validation in the game engine.' });
          return;
        }
        setWorkspaceActivation({
          id: parsed.state.id,
          saveStatus: 'saving',
          closeOnboarding: true,
        });
        setSelectedTile(null);
        setEditingNodeId(null);
        setMoveSource(null);
        setPendingCapture(null);
        setActiveTool('select');
        setTool('select');
        showNotice({ tone: 'success', message: 'CityLife plan imported.' });
      } catch {
        showNotice({ tone: 'error', message: 'The selected file could not be read.' });
      }
    },
    [loadState, setTool, showNotice, workspaceReady],
  );

  const resetToExample = useCallback(() => {
    if (!window.confirm('Replace the current plan with the example city? You can Undo immediately afterward.')) {
      return;
    }
    const previousState = JSON.stringify(latestStateRef.current);
    const nextState = createCityLifeStarterState(40);
    const loaded = loadState(JSON.stringify(nextState));
    if (!loaded) {
      showNotice({ tone: 'error', message: 'The example plan could not be loaded.' });
      return;
    }
    undoStateRef.current = previousState;
    previousGridStateRef.current = null;
    skipNextHistoryRef.current = true;
    setCanUndo(true);
    setWorkspaceActivation({
      id: nextState.id,
      saveStatus: 'saving',
      closeOnboarding: true,
    });
    setSelectedTile(null);
    setEditingNodeId(null);
    setMoveSource(null);
    setPendingCapture(null);
    setActiveTool('select');
    setTool('select');
    showNotice({ tone: 'success', message: 'Example plan restored.' });
  }, [latestStateRef, loadState, setTool, showNotice]);

  const readiness = selectedNode ? nodeReadiness(selectedNode) : null;
  const saveLabel = saveStatus === 'saving'
    ? 'Saving…'
    : saveStatus === 'saved'
      ? 'Saved locally'
      : saveStatus === 'error'
        ? 'Save failed'
        : 'Local plan';
  const saveTone = saveStatus === 'error'
    ? 'border-rose-300/20 bg-rose-400/10 text-rose-200'
    : saveStatus === 'saving'
      ? 'border-amber-300/20 bg-amber-400/10 text-amber-200'
      : 'border-emerald-300/15 bg-emerald-400/[0.07] text-emerald-200/80';

  return (
    <div className="flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#050b14] text-slate-100 md:flex-row">
      <aside className="relative z-30 w-full shrink-0 border-b border-white/10 bg-[#07101d]/95 shadow-2xl shadow-black/30 backdrop-blur-xl md:h-full md:w-[21rem] md:overflow-y-auto md:border-b-0 md:border-r">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-cyan-400/[0.06] to-transparent" />
        <div className="relative flex items-center justify-between gap-3 px-3 py-3 md:px-4 md:pb-4 md:pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div aria-hidden="true" className="relative grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-gradient-to-br from-cyan-400/15 to-indigo-400/10 shadow-[0_8px_28px_rgba(34,211,238,0.1)]">
              <span className="absolute h-3.5 w-3.5 -translate-x-1 rotate-45 border border-cyan-200/80 bg-cyan-300/35" />
              <span className="absolute h-3.5 w-3.5 translate-x-1 rotate-45 border border-indigo-200/80 bg-indigo-300/35" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold tracking-[-0.02em] text-white">CityLife</h1>
                <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-medium ${saveTone}`}>
                  <span className={`h-1.5 w-1.5 rounded-full bg-current ${saveStatus === 'saving' ? 'animate-pulse' : ''}`} />
                  {saveLabel}
                </span>
              </div>
              <p className="truncate text-[11px] text-slate-500">Commitments, connected with intention</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              className="h-9 rounded-lg border border-white/10 bg-white/[0.035] px-2.5 text-xs text-slate-300 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white md:hidden"
              aria-expanded={mobileToolsOpen}
              onClick={() => setMobileToolsOpen((open) => !open)}
            >
              {mobileToolsOpen ? 'Hide tools' : 'Tools'}
            </button>
            <Link
              href="/"
              className="grid h-9 place-items-center rounded-lg border border-white/10 bg-white/[0.035] px-2.5 text-xs text-slate-400 transition hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
            >
              IsoCity
            </Link>
          </div>
        </div>

        <div
          className={`${mobileToolsOpen ? 'block' : 'hidden'} relative max-h-[52dvh] space-y-4 overflow-y-auto border-t border-white/[0.08] px-3 py-4 shadow-2xl shadow-black/30 md:block md:max-h-none md:overflow-visible md:border-t-0 md:px-4 md:pb-6 md:shadow-none`}
        >
          <section>
            <SectionLabel>Quick capture</SectionLabel>
            <div className="rounded-xl border border-cyan-300/15 bg-gradient-to-br from-cyan-400/[0.09] via-white/[0.025] to-indigo-400/[0.04] p-3 shadow-[0_14px_40px_rgba(0,0,0,0.18)]">
              <div className="mb-2 text-[11px] leading-relaxed text-slate-400">Name what needs your attention, then give it a place.</div>
              <input
                className="w-full rounded-lg border border-white/10 bg-[#050b14]/80 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/10"
                maxLength={180}
                placeholder="What needs your attention?"
                value={captureTitle}
                onChange={(event) => setCaptureTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') beginCapture();
                }}
              />
              <div className="mt-2 flex gap-2">
                <select
                  aria-label="Activity category"
                  className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#050b14]/80 px-2.5 py-2 text-xs text-slate-200 outline-none transition focus:border-cyan-300/50"
                  value={captureTool}
                  onChange={(event) => setCaptureTool(event.target.value as Tool)}
                >
                  {CAPTURE_OPTIONS.map((option) => (
                    <option key={option.tool} value={option.tool}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="rounded-lg border border-cyan-200/30 bg-gradient-to-r from-cyan-400/25 to-sky-400/15 px-3.5 py-2 text-xs font-semibold text-cyan-50 shadow-lg shadow-cyan-950/25 transition hover:-translate-y-px hover:border-cyan-200/50 hover:from-cyan-400/35 hover:to-sky-400/25"
                  onClick={beginCapture}
                >
                  Place <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </section>

          {selectedNode && readiness && (
            <section className="relative overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.065] to-white/[0.025] p-3.5 shadow-lg shadow-black/15">
              <span aria-hidden="true" className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-gradient-to-b from-cyan-300 to-indigo-300" />
              <div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{selectedNode.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] capitalize text-slate-400">
                    <span>{selectedNode.category.replace('_', ' ')}</span>
                    <span className="text-slate-700">•</span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5">{selectedNode.metadata.status}</span>
                    <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5">{selectedNode.metadata.priority} priority</span>
                  </div>
                </div>
                <span className={`mt-2 inline-flex rounded-full border border-current/15 bg-black/15 px-2 py-1 text-[10px] font-medium ${readiness.className}`}>{readiness.label}</span>
              </div>
              {selectedNode.metadata.nextAction && (
                <div className="mt-3 rounded-r-lg border-y border-r border-white/[0.07] border-l-2 border-l-cyan-300/60 bg-black/20 px-2.5 py-2 text-xs leading-relaxed text-slate-300">
                  <span className="text-slate-500">Next: </span>
                  {selectedNode.metadata.nextAction}
                </div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-1 text-center text-[10px]">
                <div className="rounded bg-cyan-400/8 px-1 py-1.5 text-cyan-200">I {signed(selectedNode.impact.income)}</div>
                <div className="rounded bg-emerald-400/8 px-1 py-1.5 text-emerald-200">H {signed(selectedNode.impact.happiness)}</div>
                <div className="rounded bg-indigo-400/8 px-1 py-1.5 text-indigo-200">W {signed(selectedNode.impact.wellness)}</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ActionButton label="Edit details" onClick={() => setEditingNodeId(selectedNode.id)} />
                <ActionButton label="Move" onClick={() => beginMoveForNode(selectedNode)} />
              </div>
            </section>
          )}

          <section>
            <SectionLabel>Actions</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {actionTools.map((tool) => (
                <ToolButton
                  key={tool.tool}
                  tool={tool}
                  selected={activeTool === tool.tool}
                  onSelect={() => selectInteractionTool(tool.tool)}
                />
              ))}
              <ActionButton
                label="Move"
                selected={activeTool === 'move'}
                onClick={() => selectInteractionTool('move')}
              />
              <ActionButton label="Undo" disabled={!canUndo} onClick={handleUndo} />
            </div>
          </section>

          <section>
            <SectionLabel>Build directly</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {buildTools.map((tool) => (
                <ToolButton
                  key={tool.tool}
                  tool={tool}
                  selected={activeTool === tool.tool && !pendingCapture}
                  onSelect={() => selectInteractionTool(tool.tool)}
                />
              ))}
            </div>
          </section>

          <section>
            <SectionLabel>Understand & manage</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <ActionButton label="Why these scores?" onClick={() => setInsightsOpen(true)} />
              <ActionButton label="Relationship graph" onClick={() => setGraphOpen(true)} />
              <ActionButton label="Export JSON" onClick={exportWorkspace} />
              <ActionButton label="Import JSON" onClick={() => importInputRef.current?.click()} />
              <ActionButton label="Reset example" danger onClick={resetToExample} />
            </div>
          </section>

          <section className="rounded-xl border border-white/[0.07] bg-black/15 p-3.5 text-[11px] leading-relaxed text-slate-500">
            <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">Map legend</div>
            <ul className="mt-2.5 space-y-2">
              <li className="flex gap-2"><span className="text-cyan-300">◇</span><span>Buildings hold commitments and support systems.</span></li>
              <li className="flex gap-2"><span className="text-emerald-300">━</span><span>An adjacent road activates an activity.</span></li>
              <li className="flex gap-2"><span className="text-indigo-300">↔</span><span>Road distance shapes modeled relationships.</span></li>
              <li className="flex gap-2"><span className="text-amber-300">~</span><span>Scores are comparative signals, not predictions.</span></li>
            </ul>
          </section>
        </div>
      </aside>

      <section className="relative min-h-0 flex-1 bg-[#070d13]">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_52%_46%,transparent_35%,rgba(2,6,23,0.24)_78%,rgba(2,6,23,0.72)_130%)]" />
        <div className="pointer-events-none absolute left-2 right-2 top-2 z-20 grid grid-cols-3 gap-1.5 sm:left-1/2 sm:right-auto sm:top-3 sm:w-[min(840px,calc(100%-1.5rem))] sm:-translate-x-1/2 sm:gap-2">
          <MetricCard label="Income" value={snapshot.income} tone="cyan" onClick={() => setInsightsOpen(true)} />
          <MetricCard label="Happiness" value={snapshot.happiness} tone="emerald" onClick={() => setInsightsOpen(true)} />
          <MetricCard label="Wellness" value={snapshot.wellness} tone="indigo" onClick={() => setInsightsOpen(true)} />
        </div>

        <div className="pointer-events-none absolute bottom-4 right-4 z-20 hidden w-[min(370px,92vw)] overflow-hidden rounded-xl border border-white/10 bg-slate-950/90 p-3.5 text-xs shadow-2xl shadow-black/40 backdrop-blur-xl sm:block">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
          <div className="mb-2.5 flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-2 font-semibold tracking-wide text-white"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.8)]" />Network pulse</span>
            <span className="rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-1 text-[10px]">
              Active {snapshot.activeNodes}/{snapshot.totalNodes}
            </span>
          </div>
          {topEdges.length === 0 ? (
            <div className="text-slate-400">Connect activities with roads to generate meaningful relationships.</div>
          ) : (
            <div className="space-y-1.5 text-slate-300">
              {topEdges.map((edge) => {
                const a = snapshot.nodes.find((node) => node.id === edge.sourceId);
                const b = snapshot.nodes.find((node) => node.id === edge.targetId);
                return (
                  <div key={`${edge.sourceId}-${edge.targetId}`} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {(a?.name ?? 'Activity')} <span className="text-slate-500">↔</span> {(b?.name ?? 'Activity')}
                      </span>
                      <span className="shrink-0 rounded bg-black/20 px-1.5 py-0.5 font-mono text-[9px] text-slate-500">{edge.distance} steps · {edge.weight.toFixed(2)}</span>
                    </div>
                    <div className="mt-1 flex gap-3 font-mono text-[9px]">
                      <span className="text-cyan-300/80">I {signed(edge.delta.income)}</span>
                      <span className="text-emerald-300/80">H {signed(edge.delta.happiness)}</span>
                      <span className="text-indigo-300/80">W {signed(edge.delta.wellness)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {(moveSource || pendingCapture) && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-30 w-[min(540px,94vw)] -translate-x-1/2 rounded-xl border border-cyan-300/25 bg-slate-950/95 px-4 py-2.5 text-center text-xs text-cyan-50 shadow-2xl shadow-black/40 backdrop-blur-xl sm:bottom-4">
            {moveSource
              ? 'Move: choose an empty land tile. Your activity details and identity will be preserved.'
              : `Place “${pendingCapture?.title}” on an empty land tile.`}
            <button
              type="button"
              className="pointer-events-auto ml-3 rounded border border-white/20 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-white/10"
              onClick={() => selectInteractionTool('select')}
            >
              Cancel
            </button>
          </div>
        )}

        <div className="absolute inset-0">
          <CanvasIsometricGrid
            key={isMobileCanvas ? 'citylife-mobile-canvas' : 'citylife-desktop-canvas'}
            isMobile={isMobileCanvas}
            overlayMode={overlayMode}
            selectedTile={selectedTile}
            setSelectedTile={handleCanvasSelection}
          />
        </div>
      </section>

      {notice && (
        <div
          role="status"
          className={`fixed right-3 top-[4.75rem] z-[160] flex w-[min(420px,calc(100vw-1.5rem))] items-start gap-2.5 rounded-xl border bg-slate-950/95 px-3.5 py-3 text-xs leading-relaxed shadow-2xl shadow-black/50 backdrop-blur-xl md:right-4 md:top-4 ${
            notice.tone === 'error'
              ? 'border-rose-300/25 text-rose-100'
              : notice.tone === 'success'
                ? 'border-emerald-300/25 text-emerald-100'
                : 'border-sky-300/25 text-sky-100'
          }`}
        >
          <span
            aria-hidden="true"
            className={`mt-1 h-2 w-2 shrink-0 rounded-full shadow-[0_0_10px_currentColor] ${
              notice.tone === 'error'
                ? 'bg-rose-300 text-rose-300'
                : notice.tone === 'success'
                  ? 'bg-emerald-300 text-emerald-300'
                  : 'bg-sky-300 text-sky-300'
            }`}
          />
          <span>{notice.message}</span>
        </div>
      )}

      <input
        ref={importInputRef}
        className="hidden"
        type="file"
        accept="application/json,.json"
        onChange={importWorkspace}
      />

      {onboardingOpen && (
        <CityLifeOnboarding
          onChooseBlank={() => startWorkspace(createBlankCityLifeState(40))}
          onChooseExample={() => startWorkspace(createCityLifeStarterState(40))}
          onImport={() => importInputRef.current?.click()}
        />
      )}

      {editingNode && (
        <CityLifeNodeEditor
          node={editingNode}
          onClose={() => setEditingNodeId(null)}
          onSave={(metadata) => {
            updateGameState((current) => updateCityLifeNodeMetadata(current, editingNode.id, metadata));
            setEditingNodeId(null);
            showNotice({ tone: 'success', message: 'Activity details saved.' });
          }}
        />
      )}

      {insightsOpen && <CityLifeInsightsPanel snapshot={snapshot} onClose={() => setInsightsOpen(false)} />}

      {graphOpen && <CityLifeRelationshipGraphModal onClose={() => setGraphOpen(false)} snapshot={snapshot} />}
    </div>
  );
}
