export const CONFIG = {
  gridW: 28,
  gridH: 28,

  tileW: 62,
  tileH: 30,

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
  assetVersion: "2026-02-15-directional-sprites-v1",

  // Sprite renders derived from assets/GLB/in-good-order
  buildingSprites: {
    house: {
      dirs: {
        n: "assets/glb-sprites/dir/house_n.png",
        e: "assets/glb-sprites/dir/house_e.png",
        s: "assets/glb-sprites/dir/house_s.png",
        w: "assets/glb-sprites/dir/house_w.png",
      },
      scale: 0.42,
      xOffset: 0,
      yOffset: 0,
      tint: false,
    },
    school: {
      dirs: {
        n: "assets/glb-sprites/dir/university_n.png",
        e: "assets/glb-sprites/dir/university_e.png",
        s: "assets/glb-sprites/dir/university_s.png",
        w: "assets/glb-sprites/dir/university_w.png",
      },
      scale: 0.42,
      xOffset: 0,
      yOffset: 0,
      tint: false,
    },
    office: {
      dirs: {
        n: "assets/glb-sprites/dir/office_n.png",
        e: "assets/glb-sprites/dir/office_e.png",
        s: "assets/glb-sprites/dir/office_s.png",
        w: "assets/glb-sprites/dir/office_w.png",
      },
      scale: 0.44,
      xOffset: 0,
      yOffset: -1,
      tint: false,
    },
    factory: {
      dirs: {
        n: "assets/glb-sprites/dir/factory_n.png",
        e: "assets/glb-sprites/dir/factory_e.png",
        s: "assets/glb-sprites/dir/factory_s.png",
        w: "assets/glb-sprites/dir/factory_w.png",
      },
      scale: 0.41,
      xOffset: 0,
      yOffset: 0,
      tint: false,
    },
    hospital: {
      dirs: {
        n: "assets/glb-sprites/dir/hospital_n.png",
        e: "assets/glb-sprites/dir/hospital_e.png",
        s: "assets/glb-sprites/dir/hospital_s.png",
        w: "assets/glb-sprites/dir/hospital_w.png",
      },
      scale: 0.41,
      xOffset: 0,
      yOffset: 0,
      tint: false,
    },
    mall: {
      dirs: {
        n: "assets/glb-sprites/dir/mall_n.png",
        e: "assets/glb-sprites/dir/mall_e.png",
        s: "assets/glb-sprites/dir/mall_s.png",
        w: "assets/glb-sprites/dir/mall_w.png",
      },
      scale: 0.41,
      xOffset: 0,
      yOffset: 0,
      tint: false,
    },
    park: {
      dirs: {
        n: "assets/glb-sprites/dir/park_n.png",
        e: "assets/glb-sprites/dir/park_e.png",
        s: "assets/glb-sprites/dir/park_s.png",
        w: "assets/glb-sprites/dir/park_w.png",
      },
      scale: 0.40,
      xOffset: 0,
      yOffset: 0,
      tint: false,
    },
  },
};
