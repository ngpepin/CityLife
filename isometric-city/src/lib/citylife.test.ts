import { describe, expect, it } from 'vitest';
import type { BuildingType, GameState } from '@/types/game';
import {
  calculateCityLifeSnapshot,
  createBlankCityLifeState,
  migrateCityLifeNodeMetadata,
  moveCityLifeNode,
  updateCityLifeNodeMetadata,
} from '@/lib/citylife';
import { getBuildingSize, placeBuilding } from '@/lib/simulation';

function place(state: GameState, x: number, y: number, type: BuildingType): GameState {
  return placeBuilding(state, x, y, type, null);
}

function buildConnectedPair(leftType: BuildingType, rightType: BuildingType): GameState {
  let state = createBlankCityLifeState(40);
  state = place(state, 2, 2, leftType);
  state = place(state, 5, 2, rightType);

  const roadPath = [
    { x: 2, y: 3 },
    { x: 2, y: 4 },
    { x: 3, y: 4 },
    { x: 4, y: 4 },
    { x: 5, y: 4 },
    { x: 5, y: 3 },
  ];
  for (const road of roadPath) {
    state = place(state, road.x, road.y, 'road');
  }
  return state;
}

describe('CityLife road rules', () => {
  it('activates a building only from orthogonal road adjacency', () => {
    let state = createBlankCityLifeState(40);
    state = place(state, 4, 4, 'house_small');

    let node = calculateCityLifeSnapshot(state.grid, state.gridSize).nodes[0];
    expect(node.active).toBe(false);

    state = place(state, 3, 3, 'road');
    node = calculateCityLifeSnapshot(state.grid, state.gridSize).nodes[0];
    expect(node.active).toBe(false);

    state = place(state, 4, 3, 'road');
    node = calculateCityLifeSnapshot(state.grid, state.gridSize).nodes[0];
    expect(node.active).toBe(true);
    expect(node.adjacentRoads).toEqual([{ x: 4, y: 3 }]);
  });

  it('uses only connected road tiles for distance and treats pair effects symmetrically', () => {
    let disconnected = createBlankCityLifeState(40);
    disconnected = place(disconnected, 2, 2, 'house_small');
    disconnected = place(disconnected, 5, 2, 'park');
    disconnected = place(disconnected, 2, 3, 'road');
    disconnected = place(disconnected, 5, 3, 'road');

    const disconnectedSnapshot = calculateCityLifeSnapshot(disconnected.grid, disconnected.gridSize);
    expect(disconnectedSnapshot.activeNodes).toBe(2);
    expect(disconnectedSnapshot.edges).toHaveLength(0);

    const houseToParkState = buildConnectedPair('house_small', 'park');
    const parkToHouseState = buildConnectedPair('park', 'house_small');
    const houseToPark = calculateCityLifeSnapshot(houseToParkState.grid, houseToParkState.gridSize);
    const parkToHouse = calculateCityLifeSnapshot(parkToHouseState.grid, parkToHouseState.gridSize);

    expect(houseToPark.edges).toHaveLength(1);
    expect(parkToHouse.edges).toHaveLength(1);
    expect(houseToPark.edges[0].distance).toBe(5);
    expect(parkToHouse.edges[0].distance).toBe(5);
    expect(houseToPark.edges[0].weight).toBeCloseTo(parkToHouse.edges[0].weight, 12);
    expect(houseToPark.edges[0].delta).toEqual(parkToHouse.edges[0].delta);
  });

  it('treats road-carrying bridges as adjacent road graph tiles', () => {
    let state = createBlankCityLifeState(40);
    state = place(state, 2, 2, 'house_small');
    state = place(state, 6, 2, 'park');
    state = place(state, 2, 3, 'bridge');
    state = place(state, 3, 3, 'bridge');
    state = place(state, 4, 3, 'bridge');
    state = place(state, 5, 3, 'bridge');
    state = place(state, 6, 3, 'road');

    const snapshot = calculateCityLifeSnapshot(state.grid, state.gridSize);

    expect(state.grid[3][2].building.type).toBe('bridge');
    expect(snapshot.activeNodes).toBe(2);
    expect(snapshot.edges).toHaveLength(1);
    expect(snapshot.edges[0].distance).toBe(4);
    expect(snapshot.nodes.find((node) => node.x === 2 && node.y === 2)?.adjacentRoads)
      .toEqual([{ x: 2, y: 3 }]);
  });
});

describe('CityLife activity movement', () => {
  it('preserves stable identity and planning metadata when a building moves', () => {
    let state = createBlankCityLifeState(40);
    state = place(state, 2, 2, 'office_low');
    state = migrateCityLifeNodeMetadata(state);

    const initialMetadata = state.grid[2][2].building.cityLife;
    expect(initialMetadata).toBeDefined();
    if (!initialMetadata) throw new Error('Expected migrated CityLife metadata.');

    state = updateCityLifeNodeMetadata(state, initialMetadata.id, {
      ...initialMetadata,
      title: 'Prepare quarterly taxes',
      notes: 'Keep source documents together.',
      nextAction: 'Download bank statements',
      status: 'active',
      priority: 'high',
      dueDate: '2026-07-31',
      tasks: [{ id: 'task-bank-statements', text: 'Download bank statements', done: false }],
    });
    const beforeMove = state.grid[2][2].building.cityLife;
    expect(beforeMove).toBeDefined();

    const moved = moveCityLifeNode(state, { x: 2, y: 2 }, { x: 6, y: 5 });
    expect(moved.ok).toBe(true);
    if (!moved.ok || !beforeMove) throw new Error('Expected CityLife move to succeed.');

    const afterMove = moved.state.grid[5][6].building.cityLife;
    expect(moved.state.grid[2][2].building.type).toBe('grass');
    expect(moved.state.grid[5][6].building.type).toBe('office_low');
    expect(afterMove).toMatchObject({
      id: beforeMove.id,
      title: beforeMove.title,
      notes: beforeMove.notes,
      nextAction: beforeMove.nextAction,
      status: beforeMove.status,
      priority: beforeMove.priority,
      dueDate: beforeMove.dueDate,
      tasks: beforeMove.tasks,
      createdAt: beforeMove.createdAt,
    });
  });

  it.each([
    ['road', { x: 6, y: 6 }],
    ['water', { x: 7, y: 7 }],
    ['occupied tile', { x: 8, y: 8 }],
    ['out-of-bounds tile', { x: -1, y: 8 }],
  ] as const)('rejects a move onto a %s without mutating the workspace', (_label, destination) => {
    let state = createBlankCityLifeState(40);
    state = place(state, 2, 2, 'office_low');
    state = place(state, 6, 6, 'road');
    state = place(state, 7, 7, 'water');
    state = place(state, 8, 8, 'park');
    state = migrateCityLifeNodeMetadata(state);

    expect(state.grid[6][6].building.type).toBe('road');
    expect(state.grid[7][7].building.type).toBe('water');
    expect(state.grid[8][8].building.type).toBe('park');

    const serializedBeforeMove = JSON.stringify(state);
    const result = moveCityLifeNode(state, { x: 2, y: 2 }, destination);

    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
    expect(JSON.stringify(state)).toBe(serializedBeforeMove);
    expect(state.grid[2][2].building.type).toBe('office_low');
  });
});

describe('CityLife mode isolation', () => {
  it('keeps canonical IsoCity footprints unless CityLife mode is explicit', () => {
    expect(getBuildingSize('school')).toEqual({ width: 2, height: 2 });
    expect(getBuildingSize('school', false)).toEqual({ width: 2, height: 2 });
    expect(getBuildingSize('school', true)).toEqual({ width: 1, height: 1 });
  });
});
