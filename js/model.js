import { CONFIG } from "./config.js";

const STORAGE_KEY = "citylife_model_v1";

const CATEGORY_ORDER = [
  "Housing",
  "WorkCurrent",
  "WorkCapacity",
  "Leisure",
  "Health",
  "Development"
];

const DEFAULT_MODEL = {
  globals: {
    dMax: CONFIG.maxUsefulDistance,
    lambda: CONFIG.influenceFalloff,
    theta: CONFIG.influenceThreshold,
    decayRate: 0.0,
    repairRate: 0.0,
    failThreshold: 0.0,
    happinessMin: 0,
    happinessMax: 100,
    wellnessMin: 0,
    wellnessMax: 100,
    happinessBase: 50,
    wellnessBase: 50
  },
  base: {
    Housing: { I: 0.0, H: 0.6, W: 0.4 },
    WorkCurrent: { I: 2.0, H: -0.6, W: -0.4 },
    WorkCapacity: { I: 0.8, H: -0.2, W: -0.1 },
    Leisure: { I: 0.0, H: 1.2, W: 0.3 },
    Health: { I: 0.0, H: 0.2, W: 1.4 },
    Development: { I: 0.3, H: 0.1, W: 0.2 }
  },
  pairwise: {
    income: {
      Housing: { Housing: 0, WorkCurrent: 0, WorkCapacity: 0, Leisure: 0, Health: 0, Development: 0 },
      WorkCurrent: { Housing: 0.25, WorkCurrent: 0, WorkCapacity: 0.15, Leisure: 0.10, Health: 0.05, Development: 0.10 },
      WorkCapacity: { Housing: 0.20, WorkCurrent: 0.05, WorkCapacity: 0, Leisure: 0.05, Health: 0.05, Development: 0.15 },
      Leisure: { Housing: 0.0, WorkCurrent: 0.02, WorkCapacity: 0.02, Leisure: 0.0, Health: 0.01, Development: 0.02 },
      Health: { Housing: 0.0, WorkCurrent: 0.03, WorkCapacity: 0.03, Leisure: 0.02, Health: 0.0, Development: 0.02 },
      Development: { Housing: 0.05, WorkCurrent: 0.04, WorkCapacity: 0.06, Leisure: 0.03, Health: 0.03, Development: 0.0 }
    },
    happiness: {
      Housing: { Housing: 0, WorkCurrent: -0.18, WorkCapacity: -0.06, Leisure: 0.22, Health: 0.10, Development: 0.06 },
      WorkCurrent: { Housing: -0.10, WorkCurrent: 0, WorkCapacity: 0.02, Leisure: 0.08, Health: 0.05, Development: 0.03 },
      WorkCapacity: { Housing: -0.04, WorkCurrent: 0.02, WorkCapacity: 0, Leisure: 0.06, Health: 0.04, Development: 0.06 },
      Leisure: { Housing: 0.10, WorkCurrent: -0.06, WorkCapacity: -0.02, Leisure: 0, Health: 0.02, Development: 0.03 },
      Health: { Housing: 0.06, WorkCurrent: -0.04, WorkCapacity: -0.02, Leisure: 0.04, Health: 0, Development: 0.02 },
      Development: { Housing: 0.04, WorkCurrent: -0.02, WorkCapacity: -0.01, Leisure: 0.03, Health: 0.02, Development: 0 }
    },
    wellness: {
      Housing: { Housing: 0, WorkCurrent: -0.14, WorkCapacity: -0.05, Leisure: 0.08, Health: 0.20, Development: 0.05 },
      WorkCurrent: { Housing: -0.08, WorkCurrent: 0, WorkCapacity: 0.02, Leisure: 0.05, Health: 0.10, Development: 0.03 },
      WorkCapacity: { Housing: -0.03, WorkCurrent: 0.02, WorkCapacity: 0, Leisure: 0.04, Health: 0.08, Development: 0.06 },
      Leisure: { Housing: 0.05, WorkCurrent: -0.05, WorkCapacity: -0.02, Leisure: 0, Health: 0.06, Development: 0.03 },
      Health: { Housing: 0.10, WorkCurrent: -0.04, WorkCapacity: -0.02, Leisure: 0.06, Health: 0, Development: 0.04 },
      Development: { Housing: 0.03, WorkCurrent: -0.02, WorkCapacity: -0.01, Leisure: 0.02, Health: 0.04, Development: 0 }
    }
  },
  rules: []
};

const clone = (obj) => {
  if (typeof structuredClone === "function") return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
};

let model = loadModel();
const listeners = new Set();

function loadModel() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_MODEL);
    const parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch {
    return clone(DEFAULT_MODEL);
  }
}

function mergeWithDefaults(candidate) {
  const merged = clone(DEFAULT_MODEL);
  if (candidate?.globals) Object.assign(merged.globals, candidate.globals);
  if (candidate?.base) {
    for (const cat of CATEGORY_ORDER) {
      if (candidate.base[cat]) Object.assign(merged.base[cat], candidate.base[cat]);
    }
  }
  if (candidate?.pairwise) {
    for (const metric of ["income", "happiness", "wellness"]) {
      const targetMap = candidate.pairwise[metric] || {};
      for (const tgt of CATEGORY_ORDER) {
        if (targetMap[tgt]) Object.assign(merged.pairwise[metric][tgt], targetMap[tgt]);
      }
    }
  }
  if (Array.isArray(candidate?.rules)) merged.rules = candidate.rules;
  return merged;
}

function saveModel() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
}

export function getModel() {
  return clone(model);
}

export function setModel(nextModel) {
  model = mergeWithDefaults(nextModel);
  saveModel();
  emitChange();
}

export function resetModel() {
  model = clone(DEFAULT_MODEL);
  saveModel();
  emitChange();
}

export function updateModel(path, value) {
  const parts = path.split(".");
  let ref = model;
  for (let i = 0; i < parts.length - 1; i++) {
    ref = ref[parts[i]];
  }
  ref[parts[parts.length - 1]] = value;
  saveModel();
  emitChange();
}

export function onModelChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emitChange() {
  const snapshot = getModel();
  for (const cb of listeners) cb(snapshot);
}

export function categoryForType(type) {
  if (type === "house") return "Housing";
  if (type === "factory") return "WorkCurrent";
  if (type === "office") return "WorkCapacity";
  if (type === "park" || type === "mall") return "Leisure";
  if (type === "hospital") return "Health";
  if (type === "school") return "Development";
  return "Housing";
}

export function getCategories() {
  return [...CATEGORY_ORDER];
}
