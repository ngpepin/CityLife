import { expFalloff, clamp } from "./utils.js";
import { getModel, categoryForType } from "./model.js";

/**
 * Life-balance simulation:
 * - Offices (future capacity) + Factories (current income) generate income if near houses (workers).
 * - Parks/Malls/Hospitals provide happiness/wellness near houses.
 * - Factories hurt happiness if too close to houses/parks.
 * - Leisure also helps offices/factories attract workers (soft boost).
 * - Distance is shortest road distance; influence weight decays exponentially.
 */
export function computeMetrics(state, roadGraph){
  const model = getModel();
  const g = model.globals;
  const buildings = [...state.buildings.values()];

  // Determine road-active
  for (const b of buildings){
    b.active = roadGraph.roadAdjacentsForBuilding(b).length > 0;
  }

  // Base pools
  let population = 0;
  for (const b of buildings){
    if (!b.active) continue;
    if (b.type === "house") population += 10;
  }

  // Precompute pairwise road distances and weights (only among active buildings)
  const pair = new Map(); // key "aId|bId" -> {d,w}
  const ids = buildings.map(b=>b.id);
  const byId = new Map(buildings.map(b=>[b.id,b]));

  function k(a,b){ return a<b ? `${a}|${b}` : `${b}|${a}`; }

  for (let i=0; i<ids.length; i++){
    for (let j=i+1; j<ids.length; j++){
      const A = byId.get(ids[i]);
      const B = byId.get(ids[j]);
      if (!A.active || !B.active) continue;
      const d = roadGraph.roadDistanceBetweenBuildings(A,B, g.dMax);
      if (!Number.isFinite(d)) continue;
      const w = expFalloff(d, g.lambda);
      if (w < g.theta) continue;
      pair.set(k(A.id,B.id), {d,w});
    }
  }

  // Helper: sum of influence from set of types to a building
  function influenceTo(target, types){
    let sum = 0;
    for (const src of buildings){
      if (src.id === target.id) continue;
      if (!src.active || !target.active) continue;
      if (!types.includes(src.type)) continue;
      const p = pair.get(k(src.id,target.id));
      if (!p) continue;
      sum += p.w;
    }
    return sum;
  }

  function nearestPenalty(target, types){
    // penalize if too close: weight stronger at small d
    let pen = 0;
    for (const src of buildings){
      if (src.id === target.id) continue;
      if (!src.active || !target.active) continue;
      if (!types.includes(src.type)) continue;
      const p = pair.get(k(src.id,target.id));
      if (!p) continue;
      // emphasize closeness:
      const close = Math.max(0, (8 - p.d) / 8); // 0 beyond 8
      pen += close * p.w;
    }
    return pen;
  }

  // Worker accessibility for each work building
  function workerAccess(workB){
    // houses influence work: if far -> fewer workers
    let workers = 0;
    for (const h of buildings){
      if (!h.active) continue;
      if (h.type !== "house") continue;
      const p = pair.get(k(h.id, workB.id));
      if (!p) continue;
      // each house contributes 10 pop scaled by distance weight
      workers += 10 * p.w;
    }
    return workers;
  }

  // Leisure attraction bonus for work buildings
  function leisureBonus(workB){
    const l = influenceTo(workB, ["park","mall","hospital"]);
    // saturating boost
    return clamp(l / 2.2, 0, 0.35); // up to +35%
  }

  // Compute metrics from model
  let income = 0;
  let happiness = g.happinessBase;
  let wellness = g.wellnessBase;

  // Base contributions per active building
  for (const b of buildings){
    if (!b.active) continue;
    const cat = categoryForType(b.type);
    const base = model.base[cat] || { I: 0, H: 0, W: 0 };
    income += base.I;
    happiness += base.H;
    wellness += base.W;
  }

  // Pairwise contributions (directed)
  for (let i=0; i<ids.length; i++){
    for (let j=i+1; j<ids.length; j++){
      const A = byId.get(ids[i]);
      const B = byId.get(ids[j]);
      if (!A.active || !B.active) continue;
      const p = pair.get(k(A.id, B.id));
      if (!p) continue;

      const aCat = categoryForType(A.type);
      const bCat = categoryForType(B.type);

      const w = p.w;
      const incAB = model.pairwise.income?.[aCat]?.[bCat] ?? 0;
      const hapAB = model.pairwise.happiness?.[aCat]?.[bCat] ?? 0;
      const welAB = model.pairwise.wellness?.[aCat]?.[bCat] ?? 0;

      const incBA = model.pairwise.income?.[bCat]?.[aCat] ?? 0;
      const hapBA = model.pairwise.happiness?.[bCat]?.[aCat] ?? 0;
      const welBA = model.pairwise.wellness?.[bCat]?.[aCat] ?? 0;

      income += w * (incAB + incBA);
      happiness += w * (hapAB + hapBA);
      wellness += w * (welAB + welBA);
    }
  }

  // Clamp metrics
  happiness = clamp(happiness, g.happinessMin, g.happinessMax);
  wellness  = clamp(wellness, g.wellnessMin, g.wellnessMax);

  // Income is open-ended; normalize for HUD in UI
  return { income, happiness, wellness, population };
}
