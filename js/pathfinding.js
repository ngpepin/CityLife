import { inBounds, neighbors4 } from "./utils.js";

/**
 * Build a road graph and allow BFS distances between road tiles.
 * We compute shortest path length on 4-neighbor grid restricted to road tiles.
 */
export class RoadGraph {
  constructor(state){
    this.state = state;
    this.W = state.gridW;
    this.H = state.gridH;
    this.roadSet = new Set(); // "x,y"
    this.rebuild();
  }

  key(x,y){ return `${x},${y}`; }

  rebuild(){
    this.roadSet.clear();
    for (let y=0; y<this.H; y++){
      for (let x=0; x<this.W; x++){
        if (this.state.grid[y][x].road) this.roadSet.add(this.key(x,y));
      }
    }
  }

  isRoad(x,y){
    return this.roadSet.has(this.key(x,y));
  }

  // BFS from a set of start road tiles to compute distances to all roads.
  bfsFrom(starts){
    const dist = new Map();
    const q = [];
    for (const s of starts){
      const k = this.key(s.x,s.y);
      if (!this.isRoad(s.x,s.y)) continue;
      dist.set(k, 0);
      q.push(s);
    }

    while (q.length){
      const cur = q.shift();
      const d0 = dist.get(this.key(cur.x,cur.y));
      for (const nb of neighbors4(cur.x,cur.y)){
        if (!inBounds(nb.x,nb.y,this.W,this.H)) continue;
        if (!this.isRoad(nb.x,nb.y)) continue;
        const k = this.key(nb.x,nb.y);
        if (!dist.has(k)){
          dist.set(k, d0+1);
          q.push(nb);
        }
      }
    }
    return dist;
  }

  // Get all road tiles adjacent to a building at (x,y)
  roadAdjacentsForBuilding(b){
    const res = [];
    for (const nb of neighbors4(b.x,b.y)){
      if (inBounds(nb.x,nb.y,this.W,this.H) && this.isRoad(nb.x,nb.y)) res.push(nb);
    }
    return res;
  }

  // Shortest road distance between buildings (via road adjacencies).
  // Returns Infinity if either building not connected to road network.
  roadDistanceBetweenBuildings(a,b, maxDist=Infinity){
    const aAdj = this.roadAdjacentsForBuilding(a);
    const bAdj = this.roadAdjacentsForBuilding(b);
    if (!aAdj.length || !bAdj.length) return Infinity;

    // BFS from aAdj; find min dist to any bAdj
    const dist = this.bfsFrom(aAdj);
    let best = Infinity;
    for (const t of bAdj){
      const k = this.key(t.x,t.y);
      const d = dist.get(k);
      if (d !== undefined) best = Math.min(best, d);
    }
    if (best > maxDist) return Infinity;
    return best;
  }
}
