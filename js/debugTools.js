const sessionId = new Date().toISOString().replace(/[:.]/g, "-") + "_" + Math.random().toString(36).slice(2, 8);
const logBuffer = [];
let dirHandle = null;
let logFileHandle = null;
let lastFlushAt = 0;

function nowStamp() {
  return new Date().toISOString();
}

function formatEntry(entry) {
  const data = entry.data ? ` | ${JSON.stringify(entry.data)}` : "";
  return `[${entry.ts}] ${entry.level.toUpperCase()} ${entry.message}${data}`;
}

async function ensureDirHandle() {
  if (dirHandle) return dirHandle;
  if (!("showDirectoryPicker" in window)) return null;
  try {
    dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
    return dirHandle;
  } catch {
    return null;
  }
}

async function ensureLogFileHandle() {
  if (logFileHandle) return logFileHandle;
  const handle = await ensureDirHandle();
  if (!handle) return null;
  logFileHandle = await handle.getFileHandle(`log-${sessionId}.txt`, { create: true });
  return logFileHandle;
}

async function writeFile(handle, content) {
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function logEvent(level, message, data) {
  const entry = { ts: nowStamp(), level, message, data };
  logBuffer.push(entry);
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

export function initDebug() {
  logEvent("info", "session_start", { sessionId, userAgent: navigator.userAgent });

  window.addEventListener("error", (e) => {
    logEvent("error", "window_error", {
      message: e.message,
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    logEvent("error", "unhandled_rejection", { reason: String(e.reason) });
  });
}

export async function flushLogs(force = false) {
  const now = performance.now();
  if (!force && now - lastFlushAt < 1500) return;
  lastFlushAt = now;

  const content = logBuffer.map(formatEntry).join("\n") + "\n";
  const handle = await ensureLogFileHandle();
  if (handle) {
    await writeFile(handle, content);
    return;
  }

  const blob = new Blob([content], { type: "text/plain" });
  downloadBlob(blob, `debug/log-${sessionId}.txt`);
}

async function saveBlobToDebug(blob, filename) {
  const handle = await ensureDirHandle();
  if (handle) {
    const fileHandle = await handle.getFileHandle(filename, { create: true });
    await writeFile(fileHandle, blob);
    return true;
  }

  downloadBlob(blob, `debug/${filename}`);
  return false;
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)[1];
  const bytes = atob(data);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function captureCanvasScreenshot(canvas, name = "canvas") {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `shot-${name}-${ts}.png`;

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob) {
    await saveBlobToDebug(blob, filename);
    logEvent("info", "screenshot_canvas", { filename });
    await flushLogs(true);
  } else {
    logEvent("error", "screenshot_failed", { reason: "canvas_toBlob_null" });
  }
}

export async function captureGraphScreenshot(graph, name = "graph") {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `shot-${name}-${ts}.png`;

  // Cytoscape instance
  if (graph && typeof graph.png === "function") {
    const dataUrl = graph.png({ bg: "transparent", scale: 2 });
    const blob = dataUrlToBlob(dataUrl);
    await saveBlobToDebug(blob, filename);
    logEvent("info", "screenshot_graph", { filename });
    await flushLogs(true);
    return;
  }

  // vis-network instance
  if (graph && graph.canvas && graph.canvas.frame && graph.canvas.frame.canvas) {
    const canvas = graph.canvas.frame.canvas;
    const dataUrl = canvas.toDataURL("image/png");
    const blob = dataUrlToBlob(dataUrl);
    await saveBlobToDebug(blob, filename);
    logEvent("info", "screenshot_graph", { filename });
    await flushLogs(true);
    return;
  }

  logEvent("error", "screenshot_failed", { reason: "unsupported_graph_instance" });
}
