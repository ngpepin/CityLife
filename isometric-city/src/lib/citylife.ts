import { BuildingType, GameState, Tile, Tool } from '@/types/game';
import { createInitialGameState, getBuildingSize, placeBuilding } from '@/lib/simulation';

export type CityLifeCategory =
  | 'housing'
  | 'work_income'
  | 'work_capacity'
  | 'health'
  | 'leisure'
  | 'development';

type MetricVector = {
  income: number;
  happiness: number;
  wellness: number;
};

type Coord = { x: number; y: number };

type NodeAttribution = {
  id: string;
  name: string;
  value: number;
};

export interface CityLifeNode {
  id: string;
  type: BuildingType;
  name: string;
  category: CityLifeCategory;
  x: number;
  y: number;
  active: boolean;
  adjacentRoads: Coord[];
}

export interface CityLifeEdge {
  sourceId: string;
  targetId: string;
  distance: number;
  weight: number;
  delta: MetricVector;
}

export interface CityLifeSnapshot {
  income: number;
  happiness: number;
  wellness: number;
  activeNodes: number;
  totalNodes: number;
  nodes: CityLifeNode[];
  edges: CityLifeEdge[];
  topIncome: { positive: NodeAttribution[]; negative: NodeAttribution[] };
  topHappiness: { positive: NodeAttribution[]; negative: NodeAttribution[] };
  topWellness: { positive: NodeAttribution[]; negative: NodeAttribution[] };
}

export interface CityLifeTool {
  tool: Tool;
  label: string;
  description: string;
  section: 'actions' | 'build';
}

export const CITYLIFE_SPRITE_PACK_ID = 'sprites4-ages-modern';

const D_MAX = 18;
const LAMBDA = 6;
const EDGE_THRESHOLD = 0.08;
const CITYLIFE_UNLIMITED_MONEY = 999_999_999;

const BASELINE: MetricVector = {
  income: 5,
  happiness: 50,
  wellness: 50,
};

const BASE_EFFECTS: Record<CityLifeCategory, MetricVector> = {
  housing: { income: 0.8, happiness: 1.4, wellness: 1.1 },
  work_income: { income: 4.2, happiness: -1.3, wellness: -1.5 },
  work_capacity: { income: 2.5, happiness: 0.2, wellness: -0.3 },
  health: { income: -0.5, happiness: 1.3, wellness: 3.8 },
  leisure: { income: -0.2, happiness: 3.1, wellness: 1.9 },
  development: { income: 1.5, happiness: 1.0, wellness: 1.2 },
};

const CATEGORY_NAMES: Record<CityLifeCategory, string> = {
  housing: 'Housing',
  work_income: 'Work (Current)',
  work_capacity: 'Work (Capacity)',
  health: 'Health',
  leisure: 'Leisure',
  development: 'Development',
};

const TYPE_NAMES: Partial<Record<BuildingType, string>> = {
  house_small: 'House',
  house_medium: 'House',
  cabin_house: 'House',
  apartment_low: 'Housing',
  apartment_high: 'Housing',
  mansion: 'Housing',
  factory_small: 'Factory',
  factory_medium: 'Factory',
  factory_large: 'Factory',
  warehouse: 'Factory',
  power_plant: 'Factory',
  office_building_small: 'Office',
  office_low: 'Office',
  office_high: 'Office',
  hospital: 'Hospital',
  park: 'Park',
  park_large: 'Park',
  tennis: 'Park',
  shop_small: 'Mall',
  shop_medium: 'Mall',
  mall: 'Mall',
  school: 'School',
  university: 'School',
};

const CATEGORY_BY_TYPE: Partial<Record<BuildingType, CityLifeCategory>> = {
  house_small: 'housing',
  house_medium: 'housing',
  cabin_house: 'housing',
  apartment_low: 'housing',
  apartment_high: 'housing',
  mansion: 'housing',
  factory_small: 'work_income',
  factory_medium: 'work_income',
  factory_large: 'work_income',
  warehouse: 'work_income',
  power_plant: 'work_income',
  office_building_small: 'work_capacity',
  office_low: 'work_capacity',
  office_high: 'work_capacity',
  hospital: 'health',
  park: 'leisure',
  park_large: 'leisure',
  tennis: 'leisure',
  shop_small: 'leisure',
  shop_medium: 'leisure',
  mall: 'leisure',
  school: 'development',
  university: 'development',
};

export const CITYLIFE_TOOLS: CityLifeTool[] = [
  { tool: 'select', label: 'Select', description: 'Inspect tiles', section: 'actions' },
  { tool: 'road', label: 'Road', description: 'Connect activity nodes', section: 'build' },
  { tool: 'bulldoze', label: 'Bulldoze', description: 'Remove roads/buildings', section: 'actions' },
  { tool: 'house_small', label: 'House', description: 'Housing baseline', section: 'build' },
  { tool: 'school', label: 'School', description: 'Long-term development', section: 'build' },
  { tool: 'office_building_small', label: 'Office', description: 'Future income capacity', section: 'build' },
  { tool: 'factory_small', label: 'Factory', description: 'Current income output', section: 'build' },
  { tool: 'hospital', label: 'Hospital', description: 'Wellness and recovery', section: 'build' },
  { tool: 'shop_medium', label: 'Mall', description: 'Leisure and motivation', section: 'build' },
  { tool: 'park', label: 'Park', description: 'Happiness and wellness support', section: 'build' },
];

const CITYLIFE_TOOL_BUILDING_OPTIONS: Partial<Record<Tool, BuildingType[]>> = {
  house_small: ['house_small', 'house_medium', 'mansion'],
  school: ['school', 'university'],
  office_building_small: ['office_low', 'office_high'],
  factory_small: ['factory_small', 'factory_medium', 'warehouse', 'factory_large'],
  hospital: ['hospital'],
  shop_medium: ['shop_small', 'shop_medium', 'mall'],
  park: ['park', 'park_large'],
};

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

export function getCityLifeToolBuildingOptions(tool: Tool): BuildingType[] | null {
  const options = CITYLIFE_TOOL_BUILDING_OPTIONS[tool];
  return options ? [...options] : null;
}

export function placeCityLifeToolBuilding(state: GameState, x: number, y: number, tool: Tool): GameState {
  const options = getCityLifeToolBuildingOptions(tool);
  if (!options || options.length === 0) {
    return state;
  }

  const candidates = shuffleInPlace(options);
  for (const buildingType of candidates) {
    const next = placeBuilding(state, x, y, buildingType, null);
    if (next !== state) {
      return next;
    }
  }

  return state;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function keyOf(x: number, y: number): string {
  return `${x},${y}`;
}

function isRoadType(type: BuildingType): boolean {
  return type === 'road' || type === 'bridge';
}

function isBuildableNode(type: BuildingType): type is BuildingType {
  return CATEGORY_BY_TYPE[type] !== undefined;
}

function addMetricVector(target: MetricVector, delta: MetricVector): void {
  target.income += delta.income;
  target.happiness += delta.happiness;
  target.wellness += delta.wellness;
}

function scaledMetricVector(vector: MetricVector, scalar: number): MetricVector {
  return {
    income: vector.income * scalar,
    happiness: vector.happiness * scalar,
    wellness: vector.wellness * scalar,
  };
}

function pairKey(a: CityLifeCategory, b: CityLifeCategory): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function pairEffect(a: CityLifeCategory, b: CityLifeCategory, weight: number): MetricVector {
  const key = pairKey(a, b);

  switch (key) {
    case 'housing|work_income':
      return { income: 3.3 * weight, happiness: -1.6 * weight, wellness: -1.4 * weight };
    case 'housing|work_capacity':
      return { income: 2.2 * weight, happiness: 0.5 * weight, wellness: -0.2 * weight };
    case 'housing|health':
      return { income: 0.3 * weight, happiness: 1.3 * weight, wellness: 3.3 * weight };
    case 'housing|leisure':
      return { income: 0.2 * weight, happiness: 3.5 * weight, wellness: 1.5 * weight };
    case 'development|housing':
      return { income: 1.4 * weight, happiness: 0.7 * weight, wellness: 1.0 * weight };
    case 'development|work_capacity':
      return { income: 1.4 * weight, happiness: 0.6 * weight, wellness: 0.4 * weight };
    case 'development|work_income':
      return { income: 0.9 * weight, happiness: -0.3 * weight, wellness: -0.2 * weight };
    case 'leisure|work_income':
      return { income: -0.3 * weight, happiness: -1.4 * weight, wellness: -0.7 * weight };
    case 'health|work_income':
      return { income: -0.1 * weight, happiness: -0.3 * weight, wellness: -0.8 * weight };
    case 'leisure|work_capacity':
      return { income: 0.4 * weight, happiness: 1.0 * weight, wellness: 0.3 * weight };
    case 'health|leisure':
      return { income: 0, happiness: 0.7 * weight, wellness: 0.9 * weight };
    default:
      return { income: 0, happiness: 0, wellness: 0 };
  }
}

function getNodeName(type: BuildingType, category: CityLifeCategory): string {
  return TYPE_NAMES[type] ?? CATEGORY_NAMES[category];
}

function getAdjacentRoadTiles(
  grid: Tile[][],
  gridSize: number,
  x: number,
  y: number,
  width: number,
  height: number,
): Coord[] {
  const points = new Map<string, Coord>();

  const addIfRoad = (tx: number, ty: number) => {
    if (tx < 0 || ty < 0 || tx >= gridSize || ty >= gridSize) return;
    if (!isRoadType(grid[ty][tx].building.type)) return;
    points.set(keyOf(tx, ty), { x: tx, y: ty });
  };

  for (let dx = 0; dx < width; dx += 1) {
    addIfRoad(x + dx, y - 1);
    addIfRoad(x + dx, y + height);
  }
  for (let dy = 0; dy < height; dy += 1) {
    addIfRoad(x - 1, y + dy);
    addIfRoad(x + width, y + dy);
  }

  return Array.from(points.values());
}

function bfsRoadDistances(grid: Tile[][], gridSize: number, sources: Coord[]): Int16Array {
  const distance = new Int16Array(gridSize * gridSize);
  distance.fill(-1);

  const queue: Coord[] = [];
  for (const source of sources) {
    const idx = source.y * gridSize + source.x;
    if (distance[idx] !== -1) continue;
    if (!isRoadType(grid[source.y][source.x].building.type)) continue;
    distance[idx] = 0;
    queue.push(source);
  }

  let head = 0;
  while (head < queue.length) {
    const { x, y } = queue[head];
    head += 1;
    const baseIdx = y * gridSize + x;
    const baseDist = distance[baseIdx];
    const neighbors: Coord[] = [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ];

    for (const next of neighbors) {
      if (next.x < 0 || next.y < 0 || next.x >= gridSize || next.y >= gridSize) continue;
      if (!isRoadType(grid[next.y][next.x].building.type)) continue;

      const nextIdx = next.y * gridSize + next.x;
      if (distance[nextIdx] !== -1) continue;

      distance[nextIdx] = (baseDist + 1) as number;
      queue.push(next);
    }
  }

  return distance;
}

function buildNodes(grid: Tile[][], gridSize: number): CityLifeNode[] {
  const nodes: CityLifeNode[] = [];

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const tile = grid[y][x];
      const type = tile.building.type;
      if (!isBuildableNode(type)) continue;

      const category = CATEGORY_BY_TYPE[type];
      if (!category) continue;

      const size = getBuildingSize(type);
      const adjacentRoads = getAdjacentRoadTiles(grid, gridSize, x, y, size.width, size.height);
      const complete = (tile.building.constructionProgress ?? 100) >= 100;
      const active = complete && adjacentRoads.length > 0;

      nodes.push({
        id: `${type}-${x}-${y}`,
        type,
        name: getNodeName(type, category),
        category,
        x,
        y,
        active,
        adjacentRoads,
      });
    }
  }

  return nodes;
}

function getTopAttribution(
  nodes: CityLifeNode[],
  scores: Map<string, MetricVector>,
  key: keyof MetricVector,
): { positive: NodeAttribution[]; negative: NodeAttribution[] } {
  const ranked = nodes
    .filter((node) => node.active)
    .map((node) => ({
      id: node.id,
      name: `${node.name} (${node.x},${node.y})`,
      value: scores.get(node.id)?.[key] ?? 0,
    }))
    .filter((item) => Math.abs(item.value) > 0.01);

  const positive = [...ranked]
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const negative = [...ranked]
    .filter((item) => item.value < 0)
    .sort((a, b) => a.value - b.value)
    .slice(0, 3);

  return { positive, negative };
}

export function calculateCityLifeSnapshot(grid: Tile[][], gridSize: number): CityLifeSnapshot {
  const nodes = buildNodes(grid, gridSize);
  const metrics: MetricVector = { ...BASELINE };
  const edges: CityLifeEdge[] = [];

  const scores = new Map<string, MetricVector>();
  for (const node of nodes) {
    scores.set(node.id, { income: 0, happiness: 0, wellness: 0 });
  }

  for (const node of nodes) {
    if (!node.active) continue;
    const base = BASE_EFFECTS[node.category];
    addMetricVector(metrics, base);
    addMetricVector(scores.get(node.id) as MetricVector, base);
  }

  const activeNodes = nodes.filter((node) => node.active);

  for (let i = 0; i < activeNodes.length; i += 1) {
    const source = activeNodes[i];
    if (source.adjacentRoads.length === 0) continue;
    const sourceDistances = bfsRoadDistances(grid, gridSize, source.adjacentRoads);

    for (let j = i + 1; j < activeNodes.length; j += 1) {
      const target = activeNodes[j];
      if (target.adjacentRoads.length === 0) continue;

      let roadDistance = Number.POSITIVE_INFINITY;
      for (const road of target.adjacentRoads) {
        const d = sourceDistances[road.y * gridSize + road.x];
        if (d >= 0 && d < roadDistance) {
          roadDistance = d;
        }
      }

      if (!Number.isFinite(roadDistance)) continue;
      if (roadDistance > D_MAX) continue;

      const normalizedDistance = Math.max(1, roadDistance);
      const weight = Math.exp(-normalizedDistance / LAMBDA);
      if (weight < EDGE_THRESHOLD) continue;

      const delta = pairEffect(source.category, target.category, weight);
      if (Math.abs(delta.income) < 0.001 && Math.abs(delta.happiness) < 0.001 && Math.abs(delta.wellness) < 0.001) {
        continue;
      }

      addMetricVector(metrics, delta);
      addMetricVector(scores.get(source.id) as MetricVector, scaledMetricVector(delta, 0.5));
      addMetricVector(scores.get(target.id) as MetricVector, scaledMetricVector(delta, 0.5));

      edges.push({
        sourceId: source.id,
        targetId: target.id,
        distance: normalizedDistance,
        weight,
        delta,
      });
    }
  }

  edges.sort((a, b) => b.weight - a.weight);

  return {
    income: clamp(metrics.income, 0, 100),
    happiness: clamp(metrics.happiness, 0, 100),
    wellness: clamp(metrics.wellness, 0, 100),
    activeNodes: activeNodes.length,
    totalNodes: nodes.length,
    nodes,
    edges,
    topIncome: getTopAttribution(nodes, scores, 'income'),
    topHappiness: getTopAttribution(nodes, scores, 'happiness'),
    topWellness: getTopAttribution(nodes, scores, 'wellness'),
  };
}

function clearToGrass(state: GameState): GameState {
  const grid: Tile[][] = state.grid.map((row) =>
    row.map((tile): Tile => ({
      ...tile,
      zone: 'none',
      landValue: 50,
      pollution: 0,
      crime: 0,
      traffic: 0,
      hasSubway: false,
      hasRailOverlay: false,
      building: {
        ...tile.building,
        type: 'grass' as BuildingType,
        level: 0,
        population: 0,
        jobs: 0,
        powered: false,
        watered: false,
        onFire: false,
        fireProgress: 0,
        age: 0,
        constructionProgress: 100,
        abandoned: false,
        flipped: false,
      },
    })),
  );

  return {
    ...state,
    grid,
    waterBodies: [],
  };
}

function forceCompleteConstruction(state: GameState): GameState {
  const grid: Tile[][] = state.grid.map((row) =>
    row.map((tile): Tile => ({
      ...tile,
      building: {
        ...tile.building,
        powered: true,
        watered: true,
        constructionProgress: 100,
        onFire: false,
        fireProgress: 0,
        abandoned: false,
      },
    })),
  );

  return { ...state, grid };
}

export function createCityLifeStarterState(gridSize = 40): GameState {
  let state = createInitialGameState(gridSize, 'CityLife');
  state = clearToGrass(state);

  // Match the original non-IsoCity starter layout.
  const roads: Array<{ x: number; y: number }> = [];
  for (let x = 6; x <= 21; x += 1) roads.push({ x, y: 14 });
  for (let y = 9; y <= 19; y += 1) roads.push({ x: 12, y });
  for (let y = 11; y <= 17; y += 1) roads.push({ x: 18, y });
  for (let x = 10; x <= 14; x += 1) roads.push({ x, y: 10 });
  for (let x = 16; x <= 20; x += 1) roads.push({ x, y: 18 });

  for (const road of roads) {
    state = placeBuilding(state, road.x, road.y, 'road', null);
  }

  const buildings: Array<{ x: number; y: number; type: BuildingType }> = [
    { x: 10, y: 13, type: 'house_small' },
    { x: 11, y: 13, type: 'house_small' },
    { x: 10, y: 15, type: 'house_small' },
    { x: 13, y: 13, type: 'house_small' },
    { x: 13, y: 15, type: 'house_small' },
    { x: 6, y: 12, type: 'office_low' },
    { x: 19, y: 12, type: 'office_high' },
    { x: 19, y: 16, type: 'factory_small' },
    { x: 14, y: 11, type: 'park' },
    { x: 16, y: 17, type: 'shop_medium' },
    { x: 10, y: 16, type: 'hospital' },
    { x: 16, y: 15, type: 'school' },
    { x: 8, y: 15, type: 'park' },
    { x: 8, y: 13, type: 'house_small' },
  ];

  for (const building of buildings) {
    state = placeBuilding(state, building.x, building.y, building.type, null);
  }

  state = forceCompleteConstruction(state);

  return {
    ...state,
    stats: {
      ...state.stats,
      money: CITYLIFE_UNLIMITED_MONEY,
    },
    speed: 0,
    selectedTool: 'road',
    activePanel: 'none',
    disastersEnabled: false,
  };
}
