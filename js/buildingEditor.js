import { uid } from "./utils.js";
import { logEvent } from "./debugTools.js";

function byId(id) {
  return document.getElementById(id);
}

function ensureMeta(b) {
  if (!b) return;
  if (typeof b.name !== "string") b.name = "";
  if (typeof b.description !== "string") b.description = "";
  if (!Array.isArray(b.tasks)) b.tasks = [];
}

export function openBuildingEditor(state) {
  const modal = byId("buildingModal");
  const closeBtn = byId("buildingClose");
  const meta = byId("buildingMeta");
  const iconEl = byId("buildingIcon");
  const nameInput = byId("buildingName");
  const descInput = byId("buildingDesc");
  const taskInput = byId("taskText");
  const taskAdd = byId("taskAdd");
  const taskList = byId("taskList");

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  let building = null;

  function getSelectedBuilding() {
    if (state.selected && state.selected.kind === "building") {
      return state.buildings.get(state.selected.id) || null;
    }
    // fallback: first building if none selected
    return state.buildings.values().next().value || null;
  }

  function svgIconDataUrl(type, bg, active) {
    const stroke = active ? "#EAF2FF" : "rgba(230,230,240,0.65)";
    const fill = active ? bg : "rgba(120,130,150,0.5)";
    let glyph = "";

    if (type === "house") {
      glyph = `
  <path d="M8 16 L16 9 L24 16" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" />
  <rect x="9" y="16" width="14" height="9" fill="none" stroke="${stroke}" stroke-width="2" />
  <rect x="14" y="19" width="4" height="6" fill="${stroke}" />`;
    } else if (type === "office") {
      glyph = `
  <rect x="9" y="8" width="14" height="16" fill="none" stroke="${stroke}" stroke-width="2" />
  <path d="M12 12 H20 M12 16 H20 M12 20 H20" stroke="${stroke}" stroke-width="2" />`;
    } else if (type === "factory") {
      glyph = `
  <rect x="7" y="20" width="18" height="5" fill="none" stroke="${stroke}" stroke-width="2" />
  <path d="M7 20 V12 L11 14 L15 12 L19 14 L23 12 V20" fill="none" stroke="${stroke}" stroke-width="2" />
  <rect x="22" y="8" width="3" height="6" fill="${stroke}" />`;
    } else if (type === "park") {
      glyph = `
  <circle cx="17" cy="12" r="5" fill="none" stroke="${stroke}" stroke-width="2" />
  <rect x="15" y="17" width="4" height="7" fill="${stroke}" />`;
    } else if (type === "mall") {
      glyph = `
  <rect x="8" y="13" width="16" height="10" fill="none" stroke="${stroke}" stroke-width="2" />
  <path d="M8 13 L10 9 H22 L24 13" fill="none" stroke="${stroke}" stroke-width="2" />`;
    } else if (type === "hospital") {
      glyph = `
  <path d="M16 9 V23 M9 16 H23" stroke="${stroke}" stroke-width="2.4" stroke-linecap="round" />`;
    } else if (type === "school") {
      glyph = `
  <path d="M9 13 L16 9 L23 13" fill="none" stroke="${stroke}" stroke-width="2" />
  <rect x="9" y="13" width="14" height="10" fill="none" stroke="${stroke}" stroke-width="2" />`;
    } else {
      glyph = `
  <circle cx="16" cy="16" r="5" fill="none" stroke="${stroke}" stroke-width="2" />`;
    }

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <circle cx="16" cy="16" r="15" fill="${fill}" />
  ${glyph}
</svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function renderTasks() {
    taskList.innerHTML = "";
    if (!building) return;
    for (const task of building.tasks) {
      const row = document.createElement("div");
      row.className = "taskRow";
      row.dataset.taskId = task.id;

      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "taskDone";
      cb.checked = !!task.done;
      cb.addEventListener("change", () => {
        task.done = cb.checked;
      });

      const text = document.createElement("input");
      text.type = "text";
      text.value = task.text || "";
      text.addEventListener("input", () => {
        task.text = text.value;
      });

      const del = document.createElement("button");
      del.className = "toolbtn";
      del.textContent = "✕";
      del.addEventListener("click", () => {
        building.tasks = building.tasks.filter(t => t.id !== task.id);
        renderTasks();
      });

      row.appendChild(cb);
      row.appendChild(text);
      row.appendChild(del);
      taskList.appendChild(row);
    }
  }

  function render() {
    building = getSelectedBuilding();
    if (!building) {
      meta.textContent = "Select a building to edit.";
      if (iconEl) iconEl.src = "";
      nameInput.value = "";
      descInput.value = "";
      taskList.innerHTML = "";
      return;
    }

    ensureMeta(building);
    meta.textContent = `${building.type} · ${building.id}`;
    if (iconEl) {
      const color = state.getBuildingColors(building.type)?.top || "rgba(120,130,150,0.6)";
      iconEl.src = svgIconDataUrl(building.type, color, building.active);
    }
    nameInput.value = building.name;
    descInput.value = building.description;
    renderTasks();
  }

  function close() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    closeBtn.removeEventListener("click", close);
    modal.removeEventListener("click", outside);
    window.removeEventListener("keydown", esc);
    nameInput.removeEventListener("input", onName);
    descInput.removeEventListener("input", onDesc);
    taskAdd.removeEventListener("click", onAddTask);
    logEvent("info", "building_editor_close");
  }

  function outside(e) {
    if (e.target === modal) close();
  }

  function esc(e) {
    if (e.key === "Escape") close();
  }

  function onName() {
    if (!building) return;
    building.name = nameInput.value;
  }

  function onDesc() {
    if (!building) return;
    building.description = descInput.value;
  }

  function onAddTask() {
    if (!building) return;
    const text = taskInput.value.trim();
    if (!text) return;
    building.tasks.push({ id: uid("task"), text, done: false });
    taskInput.value = "";
    renderTasks();
  }

  nameInput.addEventListener("input", onName);
  descInput.addEventListener("input", onDesc);
  taskAdd.addEventListener("click", onAddTask);
  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", outside);
  window.addEventListener("keydown", esc);

  render();
  logEvent("info", "building_editor_open");
}
