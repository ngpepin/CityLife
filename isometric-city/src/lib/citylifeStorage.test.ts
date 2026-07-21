import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '@/types/game';
import {
  CITYLIFE_EXPORT_FORMAT,
  CITYLIFE_EXPORT_VERSION,
  CITYLIFE_STORAGE_KEY,
  createBlankCityLifeState,
  migrateCityLifeNodeMetadata,
  updateCityLifeNodeMetadata,
} from '@/lib/citylife';
import {
  clearCityLifeWorkspace,
  loadCityLifeWorkspace,
  parseCityLifeWorkspace,
  saveCityLifeWorkspace,
  serializeCityLifeWorkspace,
} from '@/lib/citylifeStorage';
import { placeBuilding } from '@/lib/simulation';

function createNamedWorkspace(): GameState {
  let state = createBlankCityLifeState(40);
  state = placeBuilding(state, 2, 2, 'house_small', null);
  state = migrateCityLifeNodeMetadata(state);

  const metadata = state.grid[2][2].building.cityLife;
  if (!metadata) throw new Error('Expected migrated CityLife metadata.');

  return updateCityLifeNodeMetadata(state, metadata.id, {
    ...metadata,
    title: 'Home routines',
    nextAction: 'Plan tomorrow morning',
    tasks: [{ id: 'task-plan-morning', text: 'Plan tomorrow morning', done: false }],
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CityLife workspace serialization', () => {
  it('round-trips geometry and activity metadata through the versioned envelope', () => {
    const state = createNamedWorkspace();
    const originalMetadata = state.grid[2][2].building.cityLife;
    const serialized = serializeCityLifeWorkspace(state);
    const envelope = JSON.parse(serialized) as Record<string, unknown>;

    expect(envelope.format).toBe(CITYLIFE_EXPORT_FORMAT);
    expect(envelope.version).toBe(CITYLIFE_EXPORT_VERSION);
    expect(envelope.savedAt).toEqual(expect.any(Number));

    const parsed = parseCityLifeWorkspace(serialized);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !originalMetadata) throw new Error('Expected workspace round trip to succeed.');

    expect(parsed.state.gameMode).toBe('citylife');
    expect(parsed.state.cityName).toBe('CityLife');
    expect(parsed.state.gridSize).toBe(40);
    expect(parsed.state.grid[2][2].building.type).toBe('house_small');
    expect(parsed.state.grid[2][2].building.cityLife).toMatchObject({
      id: originalMetadata.id,
      title: 'Home routines',
      nextAction: 'Plan tomorrow morning',
      tasks: originalMetadata.tasks,
    });
  });

  it('accepts a raw legacy state and migrates missing activity metadata', () => {
    let legacyState = createBlankCityLifeState(40);
    legacyState = placeBuilding(legacyState, 3, 3, 'hospital', null);
    expect(legacyState.grid[3][3].building.cityLife).toBeUndefined();

    const parsed = parseCityLifeWorkspace(JSON.stringify(legacyState));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('Expected raw legacy state migration to succeed.');

    expect(parsed.state.grid[3][3].building.cityLife).toMatchObject({
      title: 'Hospital',
      status: 'backlog',
      priority: 'medium',
      tasks: [],
    });
    expect(parsed.state.grid[3][3].building.cityLife?.id).toEqual(expect.any(String));
  });

  it('normalizes runtime-only fields before a restored workspace reaches the renderer', () => {
    const incomplete = createNamedWorkspace();
    incomplete.selectedTool = 'bulldoze';
    incomplete.speed = 3;
    incomplete.grid[2][2].building.constructionProgress = 15;
    const serialized = JSON.parse(JSON.stringify(incomplete)) as Record<string, unknown>;
    delete serialized.services;

    const parsed = parseCityLifeWorkspace(JSON.stringify(serialized));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('Expected an incomplete legacy workspace to be normalized.');

    expect(parsed.state.selectedTool).toBe('select');
    expect(parsed.state.speed).toBe(0);
    expect(parsed.state.grid[2][2].building.constructionProgress).toBe(100);
    expect(parsed.state.services.police).toHaveLength(parsed.state.gridSize);
    expect(parsed.state.services.power[0]).toHaveLength(parsed.state.gridSize);
  });

  it('regenerates duplicate activity IDs during import migration', () => {
    let state = createNamedWorkspace();
    state = placeBuilding(state, 4, 4, 'park', null);
    state = migrateCityLifeNodeMetadata(state);

    const firstId = state.grid[2][2].building.cityLife?.id;
    const secondMetadata = state.grid[4][4].building.cityLife;
    if (!firstId || !secondMetadata) throw new Error('Expected two migrated activities.');
    state.grid[4][4].building.cityLife = { ...secondMetadata, id: firstId };

    const parsed = parseCityLifeWorkspace(JSON.stringify(state));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('Expected duplicate IDs to be migrated.');

    const ids = [
      parsed.state.grid[2][2].building.cityLife?.id,
      parsed.state.grid[4][4].building.cityLife?.id,
    ];
    expect(new Set(ids).size).toBe(2);
  });
});

describe('CityLife browser persistence', () => {
  it('saves, loads, and clears the isolated CityLife workspace key', () => {
    const entries = new Map<string, string>();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
        removeItem: (key: string) => entries.delete(key),
      },
    });

    const state = createNamedWorkspace();
    const saved = saveCityLifeWorkspace(state);
    expect(saved.ok).toBe(true);
    expect(entries.has(CITYLIFE_STORAGE_KEY)).toBe(true);

    const loaded = loadCityLifeWorkspace();
    expect(loaded?.ok).toBe(true);
    if (!loaded?.ok) throw new Error('Expected persisted workspace to load.');
    expect(loaded.state.grid[2][2].building.cityLife?.title).toBe('Home routines');

    clearCityLifeWorkspace();
    expect(entries.has(CITYLIFE_STORAGE_KEY)).toBe(false);
    expect(loadCityLifeWorkspace()).toBeNull();
  });
});

describe('CityLife workspace import rejection', () => {
  it.each([
    ['', 'non-empty'],
    ['not-json', 'valid JSON'],
    ['[]', 'object'],
  ])('rejects malformed input %# without throwing', (raw, expectedMessage) => {
    const parsed = parseCityLifeWorkspace(raw);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error('Expected malformed workspace to be rejected.');
    expect(parsed.error).toContain(expectedMessage);
  });

  it('rejects an unsupported future envelope version', () => {
    const futureEnvelope = {
      format: CITYLIFE_EXPORT_FORMAT,
      version: CITYLIFE_EXPORT_VERSION + 1,
      savedAt: Date.now(),
      state: createBlankCityLifeState(40),
    };

    const parsed = parseCityLifeWorkspace(JSON.stringify(futureEnvelope));
    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error('Expected future workspace version to be rejected.');
    expect(parsed.error).toContain('newer CityLife version');
  });

  it('rejects the wrong mode and a non-square grid', () => {
    const wrongMode = { ...createBlankCityLifeState(40), gameMode: 'isocity' };
    const wrongModeResult = parseCityLifeWorkspace(JSON.stringify(wrongMode));
    expect(wrongModeResult.ok).toBe(false);

    const invalidGrid = createBlankCityLifeState(40);
    invalidGrid.grid = invalidGrid.grid.slice(0, 39);
    const invalidGridResult = parseCityLifeWorkspace(JSON.stringify(invalidGrid));
    expect(invalidGridResult.ok).toBe(false);
  });

  it('rejects unsupported building types before loading the workspace', () => {
    for (const invalidType of ['unknown_activity', 'constructor', 'toString']) {
      const invalidBuilding = createBlankCityLifeState(40);
      (invalidBuilding.grid[2][2].building as { type: string }).type = invalidType;

      const parsed = parseCityLifeWorkspace(JSON.stringify(invalidBuilding));
      expect(parsed.ok).toBe(false);
      if (parsed.ok) throw new Error('Expected an unsupported building type to be rejected.');
      expect(parsed.error).toContain('unsupported building');
    }
  });
});
