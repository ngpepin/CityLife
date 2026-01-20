export function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
export function lerp(a,b,t){ return a + (b-a)*t; }

export function uid(prefix="id"){
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

export function expFalloff(distance, falloff){
  // weight in (0,1], distance=0 -> 1
  return Math.exp(-distance / Math.max(1e-6, falloff));
}

export function round2(n){ return Math.round(n*100)/100; }

export function pretty(n){
  if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(2) + "K";
  return (Math.round(n*10)/10).toString();
}

export function distManhattan(a,b){ return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }

export function inBounds(x,y,w,h){ return x>=0 && y>=0 && x<w && y<h; }

export function neighbors4(x,y){
  return [
    {x:x+1,y},{x:x-1,y},{x,y:y+1},{x,y:y-1},
  ];
}

export function deepCopy(obj){
  return JSON.parse(JSON.stringify(obj));
}
