import { BUILDING_STATS, type Building, type GameState, type Tile } from '@/types/game';
import {
  CITYLIFE_EXPORT_FORMAT,
  CITYLIFE_EXPORT_VERSION,
  CITYLIFE_STORAGE_KEY,
  createBlankCityLifeState,
  migrateCityLifeNodeMetadata,
} from '@/lib/citylife';

export interface CityLifeExportEnvelope {
  format: typeof CITYLIFE_EXPORT_FORMAT;
  version: typeof CITYLIFE_EXPORT_VERSION;
  savedAt: number;
  state: GameState;
}

type CityLifeWorkspaceParseResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };

type CityLifeWorkspaceSaveResult =
  | { ok: true; savedAt: number }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function finiteOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

function normalizeBuilding(source: Building, fallback: Building): Building {
  const bridgeType = source.bridgeType;
  const bridgeOrientation = source.bridgeOrientation;
  const bridgePosition = source.bridgePosition;
  const bridgeTrackType = source.bridgeTrackType;

  return {
    ...fallback,
    type: source.type,
    level: finiteOr(source.level, fallback.level),
    population: finiteOr(source.population, fallback.population),
    jobs: finiteOr(source.jobs, fallback.jobs),
    powered: true,
    watered: true,
    onFire: false,
    fireProgress: 0,
    age: finiteOr(source.age, fallback.age),
    constructionProgress: 100,
    abandoned: false,
    ...(typeof source.flipped === 'boolean' ? { flipped: source.flipped } : {}),
    ...(typeof source.cityId === 'string' ? { cityId: source.cityId.slice(0, 160) } : {}),
    ...(bridgeType === 'small' || bridgeType === 'medium' || bridgeType === 'large' || bridgeType === 'suspension'
      ? { bridgeType }
      : {}),
    ...(bridgeOrientation === 'ns' || bridgeOrientation === 'ew' ? { bridgeOrientation } : {}),
    ...(isFiniteNumber(source.bridgeVariant) ? { bridgeVariant: source.bridgeVariant } : {}),
    ...(bridgePosition === 'start' || bridgePosition === 'middle' || bridgePosition === 'end'
      ? { bridgePosition }
      : {}),
    ...(isFiniteNumber(source.bridgeIndex) ? { bridgeIndex: source.bridgeIndex } : {}),
    ...(isFiniteNumber(source.bridgeSpan) ? { bridgeSpan: source.bridgeSpan } : {}),
    ...(bridgeTrackType === 'road' || bridgeTrackType === 'rail' ? { bridgeTrackType } : {}),
    ...(source.cityLife ? { cityLife: source.cityLife } : {}),
  };
}

/** Reduce imported engine state to the fields CityLife actually consumes. */
function normalizeRuntimeState(state: GameState): GameState {
  const defaults = createBlankCityLifeState(state.gridSize);
  const grid: Tile[][] = state.grid.map((row, y) =>
    row.map((tile, x) => {
      const fallback = defaults.grid[y][x];
      return {
        ...fallback,
        x,
        y,
        zone: tile.zone === 'residential' || tile.zone === 'commercial' || tile.zone === 'industrial'
          ? tile.zone
          : 'none',
        building: normalizeBuilding(tile.building, fallback.building),
        landValue: finiteOr(tile.landValue, fallback.landValue),
        pollution: finiteOr(tile.pollution, fallback.pollution),
        crime: finiteOr(tile.crime, fallback.crime),
        traffic: finiteOr(tile.traffic, fallback.traffic),
        hasSubway: tile.hasSubway === true,
        ...(typeof tile.hasRailOverlay === 'boolean' ? { hasRailOverlay: tile.hasRailOverlay } : {}),
      };
    }),
  );

  const demand: Record<string, unknown> = isRecord(state.stats.demand) ? state.stats.demand : {};
  return {
    ...defaults,
    id: typeof state.id === 'string' && state.id.trim() ? state.id.slice(0, 160) : defaults.id,
    grid,
    gridSize: state.gridSize,
    gameMode: 'citylife',
    cityName: 'CityLife',
    year: finiteOr(state.year, defaults.year),
    month: finiteOr(state.month, defaults.month),
    day: finiteOr(state.day, defaults.day),
    hour: finiteOr(state.hour, defaults.hour),
    tick: finiteOr(state.tick, defaults.tick),
    speed: 0,
    selectedTool: 'select',
    stats: {
      population: finiteOr(state.stats.population, defaults.stats.population),
      jobs: finiteOr(state.stats.jobs, defaults.stats.jobs),
      money: finiteOr(state.stats.money, defaults.stats.money),
      income: finiteOr(state.stats.income, defaults.stats.income),
      expenses: finiteOr(state.stats.expenses, defaults.stats.expenses),
      happiness: finiteOr(state.stats.happiness, defaults.stats.happiness),
      health: finiteOr(state.stats.health, defaults.stats.health),
      education: finiteOr(state.stats.education, defaults.stats.education),
      safety: finiteOr(state.stats.safety, defaults.stats.safety),
      environment: finiteOr(state.stats.environment, defaults.stats.environment),
      demand: {
        residential: finiteOr(demand.residential, defaults.stats.demand.residential),
        commercial: finiteOr(demand.commercial, defaults.stats.demand.commercial),
        industrial: finiteOr(demand.industrial, defaults.stats.demand.industrial),
      },
    },
    activePanel: 'none',
    disastersEnabled: false,
    gameVersion: finiteOr(state.gameVersion, defaults.gameVersion),
  };
}

function isStorageQuotaError(error: unknown): boolean {
  if (!isRecord(error) || typeof error.name !== 'string') return false;
  return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

function validateCityLifeState(value: unknown): CityLifeWorkspaceParseResult {
  if (!isRecord(value)) {
    return { ok: false, error: 'The workspace does not contain a valid game state.' };
  }

  if (value.gameMode !== undefined && value.gameMode !== 'citylife') {
    return { ok: false, error: 'This file belongs to a different game mode.' };
  }

  // Legacy exports predate the explicit mode field and used the fixed city name.
  if (value.gameMode === undefined && value.cityName !== 'CityLife') {
    return { ok: false, error: 'This file is not a CityLife workspace.' };
  }

  const { gridSize } = value;
  if (typeof gridSize !== 'number' || !Number.isInteger(gridSize) || gridSize < 10 || gridSize > 200) {
    return { ok: false, error: 'The CityLife grid size must be an integer between 10 and 200.' };
  }

  const { grid } = value;
  if (!Array.isArray(grid) || grid.length !== gridSize) {
    return { ok: false, error: 'The CityLife grid dimensions are invalid.' };
  }

  for (let y = 0; y < gridSize; y += 1) {
    const row = grid[y];
    if (!Array.isArray(row) || row.length !== gridSize) {
      return { ok: false, error: 'The CityLife grid must be square.' };
    }

    for (let x = 0; x < gridSize; x += 1) {
      const tile = row[x];
      if (!isRecord(tile) || !isRecord(tile.building) || typeof tile.building.type !== 'string') {
        return { ok: false, error: `The CityLife grid contains an invalid tile at (${x}, ${y}).` };
      }
      if (!Object.prototype.hasOwnProperty.call(BUILDING_STATS, tile.building.type)) {
        return { ok: false, error: `The CityLife grid contains an unsupported building at (${x}, ${y}).` };
      }
    }
  }

  const { stats } = value;
  if (
    !isRecord(stats)
    || !isFiniteNumber(stats.money)
    || !isFiniteNumber(stats.population)
  ) {
    return { ok: false, error: 'The CityLife workspace is missing essential statistics.' };
  }

  try {
    const migrated = migrateCityLifeNodeMetadata(value as unknown as GameState);
    return { ok: true, state: normalizeRuntimeState(migrated) };
  } catch {
    return { ok: false, error: 'The CityLife workspace could not be migrated safely.' };
  }
}

function createEnvelope(state: GameState, savedAt: number): CityLifeExportEnvelope {
  return {
    format: CITYLIFE_EXPORT_FORMAT,
    version: CITYLIFE_EXPORT_VERSION,
    savedAt,
    state,
  };
}

function serializeEnvelope(state: GameState, savedAt: number): string {
  return JSON.stringify(createEnvelope(state, savedAt));
}

export function serializeCityLifeWorkspace(state: GameState): string {
  return serializeEnvelope(migrateCityLifeNodeMetadata(state), Date.now());
}

export function parseCityLifeWorkspace(raw: string): CityLifeWorkspaceParseResult {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return { ok: false, error: 'Choose a non-empty CityLife workspace file.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, error: 'The selected file is not valid JSON.' };
  }

  if (!isRecord(parsed)) {
    return { ok: false, error: 'The selected JSON must contain an object.' };
  }

  const looksLikeEnvelope = 'format' in parsed || 'version' in parsed || 'state' in parsed;
  if (!looksLikeEnvelope) {
    return validateCityLifeState(parsed);
  }

  if (parsed.format !== CITYLIFE_EXPORT_FORMAT) {
    return { ok: false, error: 'The selected file uses an unrecognized workspace format.' };
  }

  if (typeof parsed.version !== 'number' || !Number.isInteger(parsed.version)) {
    return { ok: false, error: 'The CityLife workspace version is missing or invalid.' };
  }

  if (parsed.version !== CITYLIFE_EXPORT_VERSION) {
    if (parsed.version > CITYLIFE_EXPORT_VERSION) {
      return {
        ok: false,
        error: `This workspace was created by a newer CityLife version (${parsed.version}).`,
      };
    }
    return { ok: false, error: `Unsupported CityLife workspace version: ${parsed.version}.` };
  }

  if (!isFiniteNumber(parsed.savedAt) || parsed.savedAt < 0) {
    return { ok: false, error: 'The CityLife workspace save timestamp is invalid.' };
  }

  return validateCityLifeState(parsed.state);
}

export function loadCityLifeWorkspace(): CityLifeWorkspaceParseResult | null {
  if (typeof window === 'undefined') return null;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CITYLIFE_STORAGE_KEY);
  } catch {
    return {
      ok: false,
      error: 'CityLife could not access browser storage. Check this site\'s privacy settings.',
    };
  }

  return raw === null ? null : parseCityLifeWorkspace(raw);
}

export function saveCityLifeWorkspace(state: GameState): CityLifeWorkspaceSaveResult {
  if (typeof window === 'undefined') {
    return { ok: false, error: 'CityLife workspace storage is available only in a browser.' };
  }

  const validated = validateCityLifeState(state);
  if (!validated.ok) return validated;

  const savedAt = Date.now();
  let serialized: string;
  try {
    serialized = serializeEnvelope(validated.state, savedAt);
  } catch {
    return { ok: false, error: 'CityLife could not prepare this workspace for saving.' };
  }

  try {
    window.localStorage.setItem(CITYLIFE_STORAGE_KEY, serialized);
    return { ok: true, savedAt };
  } catch (error) {
    if (isStorageQuotaError(error)) {
      return { ok: false, error: 'Browser storage is full. Export the workspace before clearing site data.' };
    }
    return {
      ok: false,
      error: 'CityLife could not save to browser storage. Check this site\'s privacy settings.',
    };
  }
}

export function clearCityLifeWorkspace(): void {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.removeItem(CITYLIFE_STORAGE_KEY);
  } catch {
    // Clearing is best-effort when browser storage is blocked or unavailable.
  }
}
