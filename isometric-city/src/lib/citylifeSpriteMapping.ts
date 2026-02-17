import type { BuildingType } from '@/types/game';
import type { SpritePack } from '@/lib/renderConfig';
import mappingJson from '@/config/citylifeSpriteMapping.json';

interface SpriteSheetConfig {
  src: string;
  cols: number;
  rows: number;
}

interface CategorySpriteOption {
  sheet: string;
  row: number;
  col: number;
}

interface CategorySpriteConfig {
  buildingTypes: string[];
  sprites: CategorySpriteOption[];
}

interface CityLifeSpriteMappingConfig {
  version: number;
  enabled: boolean;
  applyWhenSpritePackId?: string;
  sheets: Record<string, SpriteSheetConfig>;
  categories: Record<string, CategorySpriteConfig>;
}

export interface CityLifeMappedSprite {
  source: string;
  cols: number;
  rows: number;
  row: number;
  col: number;
  category: string;
}

const config = mappingJson as CityLifeSpriteMappingConfig;

const buildingTypeToCategory = new Map<string, string>();
for (const [category, categoryConfig] of Object.entries(config.categories)) {
  for (const buildingType of categoryConfig.buildingTypes) {
    buildingTypeToCategory.set(buildingType, category);
  }
}

function isEnabledForPack(activePack: SpritePack): boolean {
  if (!config.enabled) return false;
  if (!config.applyWhenSpritePackId) return true;
  return activePack.id === config.applyWhenSpritePackId;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function stableIndex(max: number, tileX: number, tileY: number, buildingType: string): number {
  if (max <= 1) return 0;
  const spatial = ((tileX + 1) * 73856093) ^ ((tileY + 1) * 19349663);
  const seed = Math.abs(spatial ^ hashString(buildingType));
  return seed % max;
}

export function getCityLifeMappedSpriteForBuilding(
  buildingType: BuildingType,
  tileX: number,
  tileY: number,
  activePack: SpritePack,
): CityLifeMappedSprite | null {
  if (!isEnabledForPack(activePack)) {
    return null;
  }

  const category = buildingTypeToCategory.get(buildingType);
  if (!category) {
    return null;
  }

  const categoryConfig = config.categories[category];
  if (!categoryConfig || categoryConfig.sprites.length === 0) {
    return null;
  }

  const validOptions = categoryConfig.sprites.filter((option) => {
    const sheet = config.sheets[option.sheet];
    if (!sheet) return false;
    return option.row >= 0 && option.col >= 0 && option.row < sheet.rows && option.col < sheet.cols;
  });

  if (validOptions.length === 0) {
    return null;
  }

  const option = validOptions[stableIndex(validOptions.length, tileX, tileY, buildingType)];
  const sheet = config.sheets[option.sheet];
  if (!sheet) {
    return null;
  }

  return {
    source: sheet.src,
    cols: sheet.cols,
    rows: sheet.rows,
    row: option.row,
    col: option.col,
    category,
  };
}

export function getCityLifeSpriteMappingSheetSources(activePack: SpritePack): string[] {
  if (!isEnabledForPack(activePack)) {
    return [];
  }

  return Array.from(
    new Set(
      Object.values(config.sheets)
        .map((sheet) => sheet.src)
        .filter((src) => typeof src === 'string' && src.length > 0),
    ),
  );
}

export function getCityLifeSpriteMappingConfig(): CityLifeSpriteMappingConfig {
  return config;
}
