import { getModel, setModel, resetModel, updateModel, getCategories } from "./model.js";
import { logEvent } from "./debugTools.js";

const METRICS = [
  { key: "income", label: "Income" },
  { key: "happiness", label: "Happiness" },
  { key: "wellness", label: "Wellness" }
];

const GLOBAL_FIELDS = [
  { key: "dMax", label: "dMax", note: "Max useful road distance" },
  { key: "lambda", label: "lambda", note: "Exponential falloff scale" },
  { key: "theta", label: "theta", note: "Edge threshold" },
  { key: "decayRate", label: "decayRate", note: "Disrepair per step (inactive for now)" },
  { key: "repairRate", label: "repairRate", note: "Repair per step (inactive for now)" },
  { key: "failThreshold", label: "failThreshold", note: "Failure threshold (inactive)" },
  { key: "happinessMin", label: "H_min", note: "Happiness min" },
  { key: "happinessMax", label: "H_max", note: "Happiness max" },
  { key: "wellnessMin", label: "W_min", note: "Wellness min" },
  { key: "wellnessMax", label: "W_max", note: "Wellness max" },
  { key: "happinessBase", label: "H_base", note: "Happiness baseline" },
  { key: "wellnessBase", label: "W_base", note: "Wellness baseline" }
];

let currentTab = "globals";
let scheduled = null;

const INSTRUCTIONS = {
  globals: `
    <p><b>Globals</b> set the overall math:</p>
    <ul>
      <li><b>dMax</b> and <b>lambda</b> control distance influence decay.</li>
      <li><b>theta</b> filters weak edges in the graph.</li>
      <li><b>decayRate</b>, <b>repairRate</b>, <b>failThreshold</b> are reserved for disrepair (currently inactive).</li>
      <li><b>H/W bounds</b> clamp values after each update.</li>
      <li><b>H/W base</b> set starting baselines.</li>
    </ul>
    <p>Small changes here can significantly shift behavior.</p>
  `,
  base: `
    <p><b>Base</b> values are per-building contributions:</p>
    <ul>
      <li>Each active building adds its row to Income/Happiness/Wellness.</li>
      <li>Positive values are benefits; negatives are costs.</li>
    </ul>
    <p>Use this to set the “background” effect of each category.</p>
  `,
  income: `
    <p><b>Income K</b> defines how proximity changes income.</p>
    <ul>
      <li>Rows are <i>targets</i>; columns are <i>sources</i>.</li>
      <li>Positive = closer increases income, negative = decreases.</li>
    </ul>
    <p>Values are multiplied by distance weight $w_{ij}$.</p>
  `,
  happiness: `
    <p><b>Happiness K</b> defines how proximity changes happiness.</p>
    <ul>
      <li>Rows are <i>targets</i>; columns are <i>sources</i>.</li>
      <li>Positive = closer increases happiness, negative = decreases.</li>
    </ul>
    <p>Use this to model stress, motivation, and recovery effects.</p>
  `,
  wellness: `
    <p><b>Wellness K</b> defines how proximity changes wellness.</p>
    <ul>
      <li>Rows are <i>targets</i>; columns are <i>sources</i>.</li>
      <li>Positive = closer increases wellness, negative = decreases.</li>
    </ul>
    <p>Use this to model health support and burnout risk.</p>
  `
};

function byId(id) {
  return document.getElementById(id);
}

function createNumberInput(value, path) {
  const input = document.createElement("input");
  input.type = "number";
  input.step = "0.01";
  input.value = Number.isFinite(value) ? value : 0;
  input.dataset.path = path;
  input.className = "modelInput";
  input.addEventListener("input", () => scheduleUpdate(input));
  input.addEventListener("change", () => scheduleUpdate(input, true));
  return input;
}

function scheduleUpdate(input, immediate = false) {
  if (scheduled) clearTimeout(scheduled);
  const run = () => {
    const raw = input.value.trim();
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    updateModel(input.dataset.path, v);
  };
  if (immediate) run();
  else scheduled = setTimeout(run, 150);
}

function renderGlobals(container, model) {
  const table = document.createElement("table");
  table.className = "modelTable";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Parameter</th><th>Value</th><th>Notes</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const field of GLOBAL_FIELDS) {
    const tr = document.createElement("tr");
    const tdLabel = document.createElement("td");
    tdLabel.textContent = field.label;
    const tdValue = document.createElement("td");
    const tdNote = document.createElement("td");
    tdNote.textContent = field.note;

    const path = `globals.${field.key}`;
    const input = createNumberInput(model.globals[field.key], path);
    tdValue.appendChild(input);

    tr.appendChild(tdLabel);
    tr.appendChild(tdValue);
    tr.appendChild(tdNote);
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderBase(container, model, categories) {
  const table = document.createElement("table");
  table.className = "modelTable";
  const thead = document.createElement("thead");
  thead.innerHTML = "<tr><th>Category</th><th>I</th><th>H</th><th>W</th></tr>";
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const cat of categories) {
    const tr = document.createElement("tr");
    const tdCat = document.createElement("td");
    tdCat.textContent = cat;
    tr.appendChild(tdCat);

    for (const axis of ["I", "H", "W"]) {
      const td = document.createElement("td");
      const path = `base.${cat}.${axis}`;
      const input = createNumberInput(model.base[cat][axis], path);
      td.appendChild(input);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

function renderPairwise(container, model, categories, metricKey) {
  const table = document.createElement("table");
  table.className = "modelTable";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.innerHTML = "<th>Target \\ Source</th>";
  for (const src of categories) {
    const th = document.createElement("th");
    th.textContent = src;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (const tgt of categories) {
    const tr = document.createElement("tr");
    const tdTgt = document.createElement("td");
    tdTgt.textContent = tgt;
    tr.appendChild(tdTgt);

    for (const src of categories) {
      const td = document.createElement("td");
      const path = `pairwise.${metricKey}.${tgt}.${src}`;
      const val = model.pairwise[metricKey][tgt][src];
      const input = createNumberInput(val, path);
      td.appendChild(input);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

function setActiveTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll(".modelTab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });
  document.querySelectorAll(".modelPanel").forEach(panel => {
    panel.classList.toggle("hidden", panel.dataset.panel !== tabId);
  });
  const instructions = byId("modelInstructions");
  if (instructions) instructions.innerHTML = INSTRUCTIONS[tabId] || "";
}

function renderAll() {
  const model = getModel();
  const categories = getCategories();

  const globalsPanel = byId("modelGlobals");
  const basePanel = byId("modelBase");
  const incomePanel = byId("modelIncome");
  const happinessPanel = byId("modelHappiness");
  const wellnessPanel = byId("modelWellness");

  globalsPanel.innerHTML = "";
  basePanel.innerHTML = "";
  incomePanel.innerHTML = "";
  happinessPanel.innerHTML = "";
  wellnessPanel.innerHTML = "";

  renderGlobals(globalsPanel, model);
  renderBase(basePanel, model, categories);
  renderPairwise(incomePanel, model, categories, "income");
  renderPairwise(happinessPanel, model, categories, "happiness");
  renderPairwise(wellnessPanel, model, categories, "wellness");
}

export function openModelEditor() {
  const modal = byId("modelModal");
  const closeBtn = byId("modelClose");
  const resetBtn = byId("modelReset");
  const exportBtn = byId("modelExport");
  const importBtn = byId("modelImport");
  const importInput = byId("modelImportFile");

  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  renderAll();
  setActiveTab(currentTab);

  function close() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    closeBtn.removeEventListener("click", close);
    modal.removeEventListener("click", outside);
    window.removeEventListener("keydown", esc);
    resetBtn.removeEventListener("click", onReset);
    exportBtn.removeEventListener("click", onExport);
    importBtn.removeEventListener("click", onImport);
    importInput.removeEventListener("change", onImportFile);
    logEvent("info", "model_editor_close");
  }

  function outside(e) {
    if (e.target === modal) close();
  }

  function esc(e) {
    if (e.key === "Escape") close();
  }

  function onReset() {
    resetModel();
    renderAll();
  }

  function onExport() {
    const data = JSON.stringify(getModel(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "citylife-model.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function onImport() {
    importInput.click();
  }

  function onImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        setModel(parsed);
        renderAll();
      } catch {
        logEvent("error", "model_import_failed");
      }
    };
    reader.readAsText(file);
  }

  closeBtn.addEventListener("click", close);
  modal.addEventListener("click", outside);
  window.addEventListener("keydown", esc);
  resetBtn.addEventListener("click", onReset);
  exportBtn.addEventListener("click", onExport);
  importBtn.addEventListener("click", onImport);
  importInput.addEventListener("change", onImportFile);

  document.querySelectorAll(".modelTab").forEach(btn => {
    btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
  });

  logEvent("info", "model_editor_open");
}
