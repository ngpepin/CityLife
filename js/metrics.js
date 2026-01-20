import { expFalloff, clamp } from "./utils.js";
import { CONFIG } from "./config.js";

/**
 * Life-balance simulation:
 * - Offices (future capacity) + Factories (current income) generate income if near houses (workers).
 * - Parks/Malls/Hospitals provide happiness/wellness near houses.
 * - Factories hurt happiness if too close to houses/parks.
 * - Leisure also helps offices/factories attract workers (soft boost).
 * - Distance is shortest road distance; influence weight decays exponentially.
 */
export function computeMetrics(state, roadGraph){
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
      const d = roadGraph.roadDistanceBetweenBuildings(A,B, CONFIG.maxUsefulDistance);
      if (!Number.isFinite(d)) continue;
      const w = expFalloff(d, CONFIG.influenceFalloff);
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

  // Compute metrics
  let income = 0;
  let happiness = 50; // baseline
  let wellness = 50;  // baseline

  // Houses: contribute small baseline happiness/wellness (home stability)
  const houseCount = buildings.filter(b=>b.active && b.type==="house").length;
  happiness += houseCount * 1.2;
  wellness  += houseCount * 0.8;

  // Parks/Malls/Hospitals effects on nearby houses
  // We compute each house benefit from leisure proximity
  for (const h of buildings){
    if (!h.active || h.type!=="house") continue;

    const park = influenceTo(h, ["park"]);
    const mall = influenceTo(h, ["mall"]);
    const hosp = influenceTo(h, ["hospital"]);

    happiness += 12 * clamp(park, 0, 1.0);
    happiness +=  9 * clamp(mall, 0, 1.0);

    wellness  += 14 * clamp(hosp, 0, 1.0);
    wellness  +=  6 * clamp(park, 0, 1.0);

    // Schools: mild happiness/wellness near houses
    const school = influenceTo(h, ["school"]);
    happiness += 6 * clamp(school, 0, 0.8);
    wellness  += 4 * clamp(school, 0, 0.8);
  }

  // Work buildings
  for (const b of buildings){
    if (!b.active) continue;

    if (b.type === "office"){
      const needed = 22; // needs enough nearby workers
      const workers = workerAccess(b);
      const utilization = clamp(workers / needed, 0, 1);
      const boost = 1 + leisureBonus(b);

      // offices represent capacity & future income: stable but needs workers
      const officeIncome = 18 * utilization * boost;
      income += officeIncome;

      // too few workers can add stress (small happiness penalty)
      happiness -= (1 - utilization) * 3.0;
    }

    if (b.type === "factory"){
      const needed = 18;
      const workers = workerAccess(b);
      const utilization = clamp(workers / needed, 0, 1);
      const boost = 1 + leisureBonus(b);

      // factories represent current income: higher but volatile
      const factoryIncome = 28 * utilization * boost;
      income += factoryIncome;

      // negative externality if too close to houses/parks
      const closeToHouses = nearestPenalty(b, ["house"]);
      const closeToParks  = nearestPenalty(b, ["park"]);
      happiness -= 16 * clamp(closeToHouses, 0, 1);
      happiness -= 10 * clamp(closeToParks, 0, 1);

      // wellness penalty too (burnout)
      wellness  -= 7 * clamp(closeToHouses, 0, 1);
    }
  }

  // Malls & Parks also slightly reduce burnout (wellness) but only if connected already handled
  const parks = buildings.filter(b=>b.active && b.type==="park").length;
  wellness += parks * 1.0;

  // Clamp and derive “life balance” (optional)
  happiness = clamp(happiness, 0, 100);
  wellness  = clamp(wellness, 0, 100);

  // Income is open-ended; normalize for HUD in UI
  return { income, happiness, wellness, population };
}
