export const CONFIG = {
  gridW: 28,
  gridH: 28,

  tileW: 62,
  tileH: 34,

  // Camera
  zoomMin: 0.55,
  zoomMax: 1.75,

  // Simulation tuning
  influenceFalloff: 7.5,      // larger = influence reaches farther
  influenceThreshold: 0.08,   // graph edges only if weight >= this
  tickMs: 250,                // simulation tick (HUD updates)

  // If road distance > this, treat influence as negligible
  maxUsefulDistance: 28,

  // Aesthetic: rotation steps
  rotations: [0, 1, 2, 3], // 0..3 = 0/90/180/270
};
