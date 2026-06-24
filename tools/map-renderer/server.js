// Laughtale Map Renderer - Backend Server (Refactored)
function formatTime(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const app = express();
const PORT = 3847;
const CONFIG = {
  bdsWorldsPath: "D:\\BDS\\worlds",
  bdsExe: "D:\\BDS\\bedrock_server.exe",
  bdsCwd: "D:\\BDS",
  unminedCli: "D:\\download\\unmined-cli_0.19.60-dev_win-64bit\\unmined-cli_0.19.60-dev_win-64bit\\unmined-cli.exe",
  outputBase: path.join(__dirname, "..", "..", "assets"),
  historyFile: path.join(__dirname, "render-history.json"),
  defaultRenderRadius: 5000,
};
let activeRender = null;
let sseClients = new Set();
let bdsProcess = null;
let bdsLogs = [];
let bdsClients = new Set();
let bdsReady = false;
const BDS_LOG_CAP = 500;
let autoRegen = { enabled: false, intervalMin: 10, world: null, dimension: "overworld", areaRadius: 5000, timer: null, lastRegen: null, nextRegen: null };
let pipelineState = null;
let pregenBots = [];
let pregenState = { active: false, pct: 0, chunksDone: 0, totalChunks: 0, radius: 0, dimension: "overworld", startTime: null, botCount: 0 };
const pregenCoverage = {};
let coverageSaveTimer = null;
let _lastCpuInfo = null;
function isBdsAlive() {
  if (!bdsProcess) return false;
  try { process.kill(bdsProcess.pid, 0); return true; } catch { bdsProcess = null; return false; }
}
function bdsAppendLog(line) {
  const entry = { time: new Date().toISOString(), text: line };
  bdsLogs.push(entry); if (bdsLogs.length > BDS_LOG_CAP) bdsLogs.shift();
  const data = JSON.stringify(entry);
  for (const c of bdsClients) { try { c.write(`data: ${data}\n\n`); } catch {} }
}
function broadcastBdsEvent(eventType, payload = {}) {
  const data = JSON.stringify({ type: eventType, ...payload });
  for (const c of bdsClients) { try { c.write(`event: ${eventType}\ndata: ${data}\n\n`); } catch {} }
}
function sendBdsCommand(cmd) {
  if (!bdsProcess) return false;
  try { bdsProcess.stdin.write(cmd + "\n"); return true; } catch { return false; }
}
function countFilesLimited(dir, count = 0, limit = 10000) {
  try { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (count >= limit) return count; if (e.isFile()) count++; else if (e.isDirectory()) count = countFilesLimited(path.join(dir, e.name), count, limit); } } catch {}
  return count;
}
function getLastModified(dir) { try { return fs.statSync(dir).mtime.toISOString(); } catch { return null; } }
function loadHistory() {
  try { if (fs.existsSync(CONFIG.historyFile)) { const d = JSON.parse(fs.readFileSync(CONFIG.historyFile, "utf-8")); return Array.isArray(d) ? d : []; } } catch {}
  return [];
}
function saveHistory(entry) {
  const h = loadHistory(); h.unshift(entry); if (h.length > 50) h.length = 50;
  try { fs.writeFileSync(CONFIG.historyFile, JSON.stringify(h, null, 2)); } catch {}
}
function getActiveWorldName() {
  try { const p = fs.readFileSync(path.join(CONFIG.bdsCwd, "server.properties"), "utf-8"); const m = p.match(/^level-name=(.+)$/m); return m ? m[1].trim() : null; } catch { return null; }
}
function sleepMs(ms) { return new Promise(r => setTimeout(r, ms)); }
function getCpuUsage() {
  const cpus = os.cpus(); let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) { for (const t in cpu.times) totalTick += cpu.times[t]; totalIdle += cpu.times.idle; }
  const idle = totalIdle / cpus.length, total = totalTick / cpus.length;
  if (_lastCpuInfo) { const id = idle - _lastCpuInfo.idle, td = total - _lastCpuInfo.total; _lastCpuInfo = { idle, total }; return td > 0 ? Math.round((1 - id / td) * 100) : 0; }
  _lastCpuInfo = { idle, total }; return 0;
}
getCpuUsage();
function buildUnminedArgs({ world, dimension, mode = "web", areaRadius, area }) {
  const dimFlag = dimension === "nether" ? "-1" : dimension === "end" ? "1" : "overworld";
  const outputName = dimension === "overworld" ? `map_${world.toLowerCase()}_web` : `map_${world.toLowerCase()}_${dimension}_web`;
  const outputPath = path.join(CONFIG.outputBase, outputName);
  const worldPath = path.join(CONFIG.bdsWorldsPath, world);
  const args = [mode === "image" ? "image" : "web", "render", `--world=${worldPath}`, `--output=${mode === "image" ? outputPath + ".png" : outputPath}`, `--dimension=${dimFlag}`, "--imageformat=png", "-f"];
  if (area) args.push(`--area=b(${area.x},${area.z},${area.width},${area.height})`);
  else if (areaRadius && areaRadius > 0) { const s = areaRadius * 2; args.push(`--area=b(${-areaRadius},${-areaRadius},${s},${s})`); }
  if (mode === "image") args.push("--zoom=-4");
  return { args, outputPath, worldPath };
}
function parseUnminedLine(trimmed, r) {
  let m;
  if ((m = trimmed.match(/Found (\d+) chunks/i))) { r.totalChunks = parseInt(m[1]); r.phase = "rendering"; }
  if ((m = trimmed.match(/Rendering (?:region|zoom-out tile).*?(\d+)\s*\/\s*(\d+),?\s*([\d,.]+)%/))) { r.currentRegion = parseInt(m[1]); r.totalRegions = parseInt(m[2]); r.progress = parseFloat(m[3].replace(",", ".")); r.phase = trimmed.includes("zoom-out") ? "zoom-out" : "rendering"; }
  if ((m = trimmed.match(/(\d+) Terrain tiles rendered/))) r.tilesRendered = parseInt(m[1]);
  if ((m = trimmed.match(/Chunks rendered: (\d+) in ([\d:.]+), speed: (\d+)/))) { r.chunksRendered = parseInt(m[1]); r.renderTime = m[2]; r.speed = parseInt(m[3]); }
  if (trimmed.includes("Finished") || trimmed.includes("Saving output")) { r.phase = "saving"; r.progress = 100; }
  if ((m = trimmed.match(/World (?:size|rectangle).*?(\d+)\s*x\s*(\d+)/))) { r.worldWidth = parseInt(m[1]); r.worldHeight = parseInt(m[2]); }
  if ((m = trimmed.match(/World seed: (\d+)/))) r.worldSeed = m[1];
  if ((m = trimmed.match(/World name: (.+)/))) r.worldName = m[1].trim();
}
function createRenderDataHandler() {
  return (data) => {
    if (!activeRender) return;
    for (const line of data.toString().split("\n")) {
      const t = line.trim(); if (!t) continue;
      activeRender.logs.push(t); if (activeRender.logs.length > 100) activeRender.logs.shift();
      parseUnminedLine(t, activeRender);
    }
  };
}
function scheduleRenderCleanup(ms = 5000) {
  setTimeout(() => { if (activeRender && (activeRender.phase === "done" || activeRender.phase === "error")) activeRender = null; }, ms);
}
function getCoverageTiles(world, dimension) {
  const dimSuffix = dimension === "overworld" ? "web" : `${dimension}_web`;
  const tileDir = path.join(CONFIG.outputBase, `map_${world.toLowerCase()}_${dimSuffix}`, "tiles", "zoom.0");
  if (!fs.existsSync(tileDir)) return { tiles: [], tileDir };
  const tiles = [];
  for (const xd of fs.readdirSync(tileDir).filter(d => /^-?\d+$/.test(d))) {
    const xp = path.join(tileDir, xd); if (!fs.statSync(xp).isDirectory()) continue;
    for (const yd of fs.readdirSync(xp).filter(d => /^-?\d+$/.test(d))) {
      const yp = path.join(xp, yd); if (!fs.statSync(yp).isDirectory()) continue;
      for (const f of fs.readdirSync(yp).filter(f => f.startsWith("tile.") && (f.endsWith(".jpeg") || f.endsWith(".png")))) {
        const m = f.match(/^tile\.(-?\d+)\.(-?\d+)\./); if (m) tiles.push({ x: parseInt(m[1]), z: parseInt(m[2]) });
      }
    }
    if (tiles.length > 50000) break;
  }
  return { tiles, tileDir };
}
function findGapTiles(tiles) {
  if (!tiles.length) return { gaps: [], minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const t of tiles) { if (t.x < minX) minX = t.x; if (t.x > maxX) maxX = t.x; if (t.z < minZ) minZ = t.z; if (t.z > maxZ) maxZ = t.z; }
  const set = new Set(tiles.map(t => `${t.x},${t.z}`)), gaps = [];
  for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) if (!set.has(`${x},${z}`)) gaps.push({ x, z });
  return { gaps, minX, maxX, minZ, maxZ };
}
const COVERAGE_DIR = path.join(__dirname, "pregen-data");
if (!fs.existsSync(COVERAGE_DIR)) fs.mkdirSync(COVERAGE_DIR, { recursive: true });
function getCoverageFile(dim) { return path.join(COVERAGE_DIR, `coverage-${dim.replace(/\s+/g, "_")}.json`); }
function loadCoverage(dim) {
  if (pregenCoverage[dim]) return pregenCoverage[dim];
  try { const f = getCoverageFile(dim); if (fs.existsSync(f)) { const raw = JSON.parse(fs.readFileSync(f, "utf8")); pregenCoverage[dim] = { step: raw.step||32, radius: raw.radius||0, halfGrid: raw.halfGrid||0, completed: new Set(raw.completed||[]), failed: new Set(raw.failed||[]), updatedAt: raw.updatedAt||Date.now() }; return pregenCoverage[dim]; } } catch {}
  pregenCoverage[dim] = { step: 32, radius: 0, halfGrid: 0, completed: new Set(), failed: new Set(), updatedAt: Date.now() };
  return pregenCoverage[dim];
}
function saveCoverage(dim) {
  const c = pregenCoverage[dim]; if (!c) return;
  try { fs.writeFileSync(getCoverageFile(dim), JSON.stringify({ step: c.step, radius: c.radius, halfGrid: c.halfGrid, completed: [...c.completed], failed: [...c.failed], updatedAt: Date.now() })); } catch {}
}
function addPregenPos(dim, x, z, isFail) {
  const c = loadCoverage(dim);
  const cx1 = Math.floor(x/16), cz1 = Math.floor(z/16), cx2 = Math.floor((x-1)/16), cz3 = Math.floor((z-1)/16);
  for (const k of [`${cx1},${cz1}`, `${cx2},${cz1}`, `${cx2},${cz3}`, `${cx1},${cz3}`]) { if (isFail) c.failed.add(k); else { c.completed.add(k); c.failed.delete(k); } }
}
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/tiles", express.static(CONFIG.outputBase, { maxAge: "1h", immutable: false }));
app.get("/tile/:world/:dim/:z/:x/:y", (req, res) => {
  const { world, dim, z, x, y } = req.params;
  if (!/^[A-Za-z0-9_-]+$/.test(world) || !/^[a-z]+$/.test(dim)) return res.status(400).end();
  const zN = parseInt(z), xN = parseInt(x), yN = parseInt(y);
  if (isNaN(zN) || isNaN(xN) || isNaN(yN)) return res.status(400).end();
  const dimSuffix = dim === "overworld" ? "web" : `${dim}_web`;
  const mapDir = `map_${world.toLowerCase()}_${dimSuffix}`;
  const xd = xN >= 0 ? Math.floor(xN/10) : -Math.ceil(Math.abs(xN)/10);
  const yd = yN >= 0 ? Math.floor(yN/10) : -Math.ceil(Math.abs(yN)/10);
  const tilePath = path.join(CONFIG.outputBase, mapDir, "tiles", `zoom.${zN}`, String(xd), String(yd), `tile.${xN}.${yN}.jpeg`);
  if (!tilePath.startsWith(CONFIG.outputBase)) return res.status(403).end();
  res.set("Cache-Control", "no-cache");
  const pngPath = tilePath.replace(".jpeg", ".png");
  if (fs.existsSync(pngPath)) { res.type("image/png"); return res.sendFile(pngPath); }
  if (fs.existsSync(tilePath)) { res.type("image/jpeg"); return res.sendFile(tilePath); }
  res.status(404).end();
});
app.get("/api/map-props/:world/:dim", (req, res) => {
  const { world, dim } = req.params;
  if (!/^[A-Za-z0-9_-]+$/.test(world) || !/^[a-z]+$/.test(dim)) return res.status(400).json({ error: "Invalid" });
  const dimSuffix = dim === "overworld" ? "web" : `${dim}_web`;
  const propsPath = path.join(CONFIG.outputBase, `map_${world.toLowerCase()}_${dimSuffix}`, "unmined.map.properties.js");
  if (!propsPath.startsWith(CONFIG.outputBase)) return res.status(403).json({ error: "Forbidden" });
  if (!fs.existsSync(propsPath)) return res.json({ exists: false });
  try {
    const content = fs.readFileSync(propsPath, "utf-8");
    const ex = (key) => { const r = content.match(new RegExp(`${key}:\\s*([^,}\\n]+)`)); return r ? r[1].trim().replace(/"/g, "") : null; };
    res.json({ exists: true, minZoom: parseInt(ex("minZoom"))||-6, maxZoom: parseInt(ex("maxZoom"))||0, defaultZoom: parseInt(ex("defaultZoom"))||0, imageFormat: ex("imageFormat")||"jpeg", minRegionX: parseInt(ex("minRegionX"))||0, minRegionZ: parseInt(ex("minRegionZ"))||0, maxRegionX: parseInt(ex("maxRegionX"))||0, maxRegionZ: parseInt(ex("maxRegionZ"))||0, worldName: ex("worldName")||world, centerX: parseInt(ex("centerX"))||0, centerZ: parseInt(ex("centerZ"))||0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get("/api/worlds", (req, res) => {
  try {
    if (!fs.existsSync(CONFIG.bdsWorldsPath)) return res.json({ worlds: [], unminedFound: fs.existsSync(CONFIG.unminedCli) });
    const worlds = [];
    for (const entry of fs.readdirSync(CONFIG.bdsWorldsPath, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const wp = path.join(CONFIG.bdsWorldsPath, entry.name);
      if (!fs.existsSync(path.join(wp, "level.dat"))) continue;
      const dbPath = path.join(wp, "db"); let dbSizeMB = 0;
      if (fs.existsSync(dbPath)) { try { for (const f of fs.readdirSync(dbPath)) { try { const s = fs.statSync(path.join(dbPath, f)); if (s.isFile()) dbSizeMB += s.size; } catch {} } dbSizeMB = Math.round((dbSizeMB/1024/1024)*10)/10; } catch {} }
      const renders = {};
      for (const dim of ["overworld","nether","end"]) {
        const ds = dim === "overworld" ? "web" : `${dim}_web`;
        const cd = path.join(CONFIG.outputBase, `map_${entry.name.toLowerCase()}_${ds}`, "tiles");
        if (fs.existsSync(cd)) renders[dim] = { rendered: true, tileCount: countFilesLimited(cd, 0, 10000), lastModified: getLastModified(cd) };
        else renders[dim] = { rendered: false, tileCount: 0 };
      }
      const imgPath = path.join(CONFIG.outputBase, `map_${entry.name.toLowerCase()}.png`);
      let hasImage = false, imageSizeKB = 0;
      if (fs.existsSync(imgPath)) { hasImage = true; imageSizeKB = Math.round(fs.statSync(imgPath).size/1024); }
      worlds.push({ name: entry.name, path: wp, dbSizeMB, renders, hasImage, imageSizeKB });
    }
    res.json({ worlds, unminedFound: fs.existsSync(CONFIG.unminedCli) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/render", (req, res) => {
  if (activeRender && activeRender.phase !== "done" && activeRender.phase !== "error") return res.status(409).json({ error: "Render sedang berjalan." });
  const { world, dimension = "overworld", mode = "web", areaRadius } = req.body;
  if (!world || typeof world !== "string") return res.status(400).json({ error: "World name required" });
  if (!/^[A-Za-z0-9_-]+$/.test(world)) return res.status(400).json({ error: "Invalid world name" });
  if (!["overworld","nether","end"].includes(dimension)) return res.status(400).json({ error: "Invalid dimension" });
  if (!["web","image"].includes(mode)) return res.status(400).json({ error: "Invalid mode" });
  if (!fs.existsSync(path.join(CONFIG.bdsWorldsPath, world))) return res.status(404).json({ error: "World not found" });
  if (!fs.existsSync(CONFIG.unminedCli)) return res.status(500).json({ error: "Unmined CLI not found" });
  const radius = typeof areaRadius === "number" && areaRadius > 0 ? areaRadius : CONFIG.defaultRenderRadius;
  const { args, outputPath } = buildUnminedArgs({ world, dimension, mode, areaRadius: radius });
  console.log(`[Render] Starting: unmined-cli ${args.join(" ")}`);
  let proc;
  try { proc = spawn(CONFIG.unminedCli, args, { cwd: path.dirname(CONFIG.unminedCli) }); }
  catch (e) { return res.status(500).json({ error: `Failed to start: ${e.message}` }); }
  activeRender = { proc, world, dimension, mode, progress: 0, totalRegions: 0, currentRegion: 0, phase: "scanning", startTime: Date.now(), logs: [], outputPath };
  const hd = createRenderDataHandler(); proc.stdout.on("data", hd); proc.stderr.on("data", hd);
  proc.on("close", (code) => {
    if (!activeRender) return;
    if (code === 0) saveHistory({ world, dimension, mode, timestamp: Date.now(), duration: Date.now()-activeRender.startTime, chunksRendered: activeRender.chunksRendered||0, tilesRendered: activeRender.tilesRendered||0, speed: activeRender.speed||0 });
    activeRender.exitCode = code; activeRender.phase = code === 0 ? "done" : "error"; activeRender.progress = code === 0 ? 100 : activeRender.progress; activeRender.endTime = Date.now();
    scheduleRenderCleanup(5000);
  });
  proc.on("error", (err) => { if (activeRender) { activeRender.phase = "error"; activeRender.error = err.message; } scheduleRenderCleanup(5000); });
  res.json({ status: "started", world, dimension, mode, message: `Rendering ${world} (${dimension}) in ${mode} mode...` });
});

// -- SSE Progress --
app.get("/api/render/progress", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  const sendData = () => {
    try {
      if (activeRender) {
        const d = { ...activeRender }; delete d.proc; delete d.logs;
        if (activeRender.logs) d.lastLog = activeRender.logs.slice(-5);
        d.elapsed = Math.floor((Date.now() - activeRender.startTime) / 1000);
        res.write(`data: ${JSON.stringify(d)}\n\n`);
      } else { res.write(`data: ${JSON.stringify({ phase: "idle" })}\n\n`); }
    } catch {}
  };
  sendData();
  const interval = setInterval(sendData, 1000);
  sseClients.add(interval);
  req.on("close", () => { clearInterval(interval); sseClients.delete(interval); });
});
app.post("/api/render/cancel", (req, res) => {
  if (!activeRender || !activeRender.proc) return res.status(404).json({ error: "No active render" });
  try { activeRender.proc.kill(); activeRender.phase = "cancelled"; activeRender = null; res.json({ status: "cancelled" }); }
  catch (e) { activeRender = null; res.json({ status: "cancelled", warning: e.message }); }
});
function triggerRenderInternal(world, dimension) {
  if (activeRender && activeRender.proc) return false;
  if (activeRender && activeRender.phase === "done" && activeRender.endTime && Date.now() - activeRender.endTime < 60000) return false;
  if (!isBdsAlive() || !world || !fs.existsSync(path.join(CONFIG.bdsWorldsPath, world)) || !fs.existsSync(CONFIG.unminedCli)) return false;
  const { args, outputPath } = buildUnminedArgs({ world, dimension, areaRadius: autoRegen.areaRadius || CONFIG.defaultRenderRadius });
  try {
    const proc = spawn(CONFIG.unminedCli, args, { cwd: path.dirname(CONFIG.unminedCli) });
    activeRender = { proc, world, dimension, mode: "web", progress: 0, totalRegions: 0, currentRegion: 0, phase: "scanning", startTime: Date.now(), logs: [], outputPath };
    const hd = createRenderDataHandler(); proc.stdout.on("data", hd); proc.stderr.on("data", hd);
    proc.on("close", (code) => {
      if (!activeRender) return;
      activeRender.exitCode = code; activeRender.phase = code === 0 ? "done" : "error"; activeRender.endTime = Date.now(); activeRender.proc = null;
      if (code === 0) { broadcastBdsEvent("render_done", { world, dimension }); bdsAppendLog(`[Dashboard] Map render selesai: ${world}/${dimension}`); }
      scheduleRenderCleanup(10000);
    });
    return true;
  } catch { return false; }
}
function startAutoRegen() {
  stopAutoRegen(); if (!autoRegen.world || !isBdsAlive()) return;
  autoRegen.enabled = true; autoRegen.nextRegen = new Date(Date.now() + autoRegen.intervalMin * 60000).toISOString();
  autoRegen.timer = setInterval(() => {
    if (!isBdsAlive()) { stopAutoRegen(); return; }
    autoRegen.lastRegen = new Date().toISOString(); autoRegen.nextRegen = new Date(Date.now() + autoRegen.intervalMin * 60000).toISOString();
    triggerRenderInternal(autoRegen.world, autoRegen.dimension);
  }, autoRegen.intervalMin * 60000);
}
function stopAutoRegen() { if (autoRegen.timer) { clearInterval(autoRegen.timer); autoRegen.timer = null; } autoRegen.enabled = false; autoRegen.nextRegen = null; }
app.get("/api/autoregen", (req, res) => { res.json({ enabled: autoRegen.enabled, intervalMin: autoRegen.intervalMin, world: autoRegen.world, dimension: autoRegen.dimension, lastRegen: autoRegen.lastRegen, nextRegen: autoRegen.nextRegen, bdsRunning: bdsProcess !== null }); });
app.post("/api/autoregen", (req, res) => {
  const { enabled, intervalMin, world, dimension, areaRadius } = req.body;
  if (world) autoRegen.world = world;
  if (dimension && ["overworld","nether","end"].includes(dimension)) autoRegen.dimension = dimension;
  if (intervalMin && intervalMin >= 1 && intervalMin <= 120) autoRegen.intervalMin = intervalMin;
  if (typeof areaRadius === "number" && areaRadius >= 0) autoRegen.areaRadius = areaRadius;
  if (enabled === true) { if (!autoRegen.world) return res.status(400).json({ error: "Set world first" }); if (!isBdsAlive()) return res.status(400).json({ error: "BDS not running" }); startAutoRegen(); }
  else if (enabled === false) stopAutoRegen();
  res.json({ enabled: autoRegen.enabled, intervalMin: autoRegen.intervalMin, world: autoRegen.world, dimension: autoRegen.dimension, areaRadius: autoRegen.areaRadius, nextRegen: autoRegen.nextRegen });
});
app.get("/api/coverage/:world/:dimension", (req, res) => {
  const { world, dimension } = req.params;
  if (!/^[A-Za-z0-9_-]+$/.test(world) || !/^[a-z]+$/.test(dimension)) return res.status(400).json({ error: "Invalid" });
  try {
    const { tiles } = getCoverageTiles(world, dimension); const { gaps, minX, maxX, minZ, maxZ } = findGapTiles(tiles);
    const tp = (maxX-minX+1)*(maxZ-minZ+1);
    res.json({ totalTiles: tiles.length, totalPossible: tp, gapCount: gaps.length, coverage: tp > 0 ? ((tiles.length/tp)*100).toFixed(2) : "100", bounds: { minX, maxX, minZ, maxZ }, gaps: gaps.slice(0, 200) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get("/api/render/gaps/:world/:dimension", (req, res) => {
  const { world, dimension } = req.params;
  if (!/^[A-Za-z0-9_-]+$/.test(world) || !/^[a-z]+$/.test(dimension)) return res.status(400).json({ error: "Invalid" });
  try {
    const { tiles } = getCoverageTiles(world, dimension); const { gaps, minX, maxX, minZ, maxZ } = findGapTiles(tiles);
    const tp = (maxX-minX+1)*(maxZ-minZ+1);
    res.json({ totalTiles: tiles.length, totalPossible: tp, gapCount: gaps.length, coverage: tp > 0 ? ((tiles.length/tp)*100).toFixed(2) : "100", bounds: { minX, maxX, minZ, maxZ }, gaps: gaps.slice(0, 200) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post("/api/render/fill-gaps", (req, res) => {
  if (activeRender && activeRender.phase !== "done" && activeRender.phase !== "error") return res.status(409).json({ error: "Render sedang berjalan." });
  const { world, dimension = "overworld" } = req.body;
  if (!world || !/^[A-Za-z0-9_-]+$/.test(world)) return res.status(400).json({ error: "Invalid world" });
  if (!["overworld","nether","end"].includes(dimension)) return res.status(400).json({ error: "Invalid dimension" });
  if (!fs.existsSync(path.join(CONFIG.bdsWorldsPath, world))) return res.status(404).json({ error: "World not found" });
  if (!fs.existsSync(CONFIG.unminedCli)) return res.status(500).json({ error: "Unmined CLI not found" });
  const { tiles } = getCoverageTiles(world, dimension); const { gaps, minX, maxX, minZ, maxZ } = findGapTiles(tiles);
  if (!gaps.length) return res.json({ status: "perfect", message: "Coverage 100%!" });
  const BPT = 256, PAD = 512;
  const area = { x: minX*BPT-PAD, z: minZ*BPT-PAD, width: (maxX+1)*BPT+PAD-(minX*BPT-PAD), height: (maxZ+1)*BPT+PAD-(minZ*BPT-PAD) };
  const { args, outputPath } = buildUnminedArgs({ world, dimension, area });
  let proc; try { proc = spawn(CONFIG.unminedCli, args, { cwd: path.dirname(CONFIG.unminedCli) }); } catch (e) { return res.status(500).json({ error: e.message }); }
  activeRender = { proc, world, dimension, mode: "web", progress: 0, totalRegions: 0, currentRegion: 0, phase: "scanning", startTime: Date.now(), logs: [`[FillGaps] Filling ${gaps.length} gaps`], outputPath, isFillGaps: true, gapCount: gaps.length, originalCoverage: tiles.length, totalPossible: (maxX-minX+1)*(maxZ-minZ+1) };
  const hd = createRenderDataHandler(); proc.stdout.on("data", hd); proc.stderr.on("data", hd);
  proc.on("close", (code) => {
    if (!activeRender) return;
    activeRender.exitCode = code; activeRender.phase = code === 0 ? "done" : "error"; activeRender.progress = code === 0 ? 100 : activeRender.progress; activeRender.endTime = Date.now();
    if (code === 0) { const nt = getCoverageTiles(world, dimension); const ng = findGapTiles(nt.tiles); activeRender.remainingGaps = ng.gaps.length; activeRender.newTileCount = nt.tiles.length; saveHistory({ world, dimension, mode: "fill-gaps", timestamp: Date.now(), duration: Date.now()-activeRender.startTime, gapsFilled: gaps.length-ng.gaps.length, gapsRemaining: ng.gaps.length }); }
    scheduleRenderCleanup(5000);
  });
  proc.on("error", (err) => { if (activeRender) { activeRender.phase = "error"; activeRender.error = err.message; } scheduleRenderCleanup(5000); });
  res.json({ status: "started", gapCount: gaps.length, totalTiles: tiles.length, totalPossible: (maxX-minX+1)*(maxZ-minZ+1) });
});
function pLog(msg) { bdsAppendLog("[SafeRender] " + msg); broadcastBdsEvent("pipeline_progress", { phase: pipelineState ? pipelineState.phase : "unknown", msg }); }
function waitBdsExit(timeout) { return new Promise((resolve, reject) => { if (!bdsProcess) return resolve(); const t = setTimeout(() => { try { bdsProcess.kill("SIGKILL"); } catch {} reject(new Error("BDS stop timeout")); }, timeout); bdsProcess.once("close", () => { clearTimeout(t); resolve(); }); }); }
function waitBdsReady(timeout) { return new Promise((resolve, reject) => { const t = setTimeout(() => reject(new Error("BDS startup timeout")), timeout); const iv = setInterval(() => { if (bdsReady) { clearTimeout(t); clearInterval(iv); resolve(); } if (!isBdsAlive()) { clearTimeout(t); clearInterval(iv); reject(new Error("BDS crashed")); } }, 1000); }); }
app.get("/api/pipeline/status", (req, res) => { res.json(pipelineState || { phase: "idle" }); });
app.post("/api/pipeline/start", async (req, res) => {
  if (pipelineState && !["done","error","idle"].includes(pipelineState.phase)) return res.status(409).json({ error: "Pipeline running" });
  if (activeRender && !["done","error"].includes(activeRender.phase)) return res.status(409).json({ error: "Render running" });
  if (pregenState.active) return res.status(409).json({ error: "PreGen running" });
  const { world, dimension = "overworld" } = req.body;
  if (!world || !/^[A-Za-z0-9_-]+$/.test(world)) return res.status(400).json({ error: "Invalid world" });
  const worldPath = path.join(CONFIG.bdsWorldsPath, world);
  if (!fs.existsSync(worldPath)) return res.status(404).json({ error: "World not found" });
  pipelineState = { phase: "init", world, dimension, startTime: Date.now() }; res.json({ status: "started" });
  try {
    if (isBdsAlive()) { pipelineState.phase = "stopping_bds"; pLog("Stopping BDS..."); sendBdsCommand("stop"); await waitBdsExit(30000); }
    const dbDir = path.join(worldPath, "db");
    const walFiles = fs.existsSync(dbDir) ? fs.readdirSync(dbDir).filter(f => /^\d+\.log$/.test(f)) : [];
    const needsCompact = walFiles.some(f => fs.statSync(path.join(dbDir, f)).size > 100000);
    if (needsCompact) {
      pipelineState.phase = "compacting"; pLog("WAL compact..."); bdsLogs = []; bdsReady = false;
      bdsProcess = spawn(CONFIG.bdsExe, [], { cwd: CONFIG.bdsCwd, stdio: ["pipe","pipe","pipe"] });
      const ho = (s) => { let buf = ""; s.on("data", (ch) => { buf += ch.toString(); const ls = buf.split("\n"); buf = ls.pop(); for (const l of ls) { if (l.trim()) bdsAppendLog(l.trim()); if (l.includes("Server started")) bdsReady = true; } }); };
      ho(bdsProcess.stdout); ho(bdsProcess.stderr); bdsProcess.once("close", () => { bdsProcess = null; });
      await waitBdsReady(90000); sendBdsCommand("stop"); await waitBdsExit(30000); pLog("WAL compacted."); await sleepMs(2000);
    }
    pipelineState.phase = "rendering"; pLog("Rendering...");
    const { args } = buildUnminedArgs({ world, dimension });
    await new Promise((resolve, reject) => {
      const p = spawn(CONFIG.unminedCli, args, { cwd: path.dirname(CONFIG.unminedCli) });
      activeRender = { proc: p, world, dimension, mode: "web", progress: 0, totalRegions: 0, currentRegion: 0, phase: "scanning", startTime: Date.now(), logs: [] };
      const hd = createRenderDataHandler(); p.stdout.on("data", hd); p.stderr.on("data", hd);
      p.once("close", (c) => { if (activeRender) { activeRender.phase = c === 0 ? "done" : "error"; activeRender.proc = null; } c === 0 ? resolve() : reject(new Error("Exit " + c)); });
      p.once("error", (e) => { if (activeRender) { activeRender.phase = "error"; activeRender.proc = null; } reject(e); });
    });
    pLog("Render done!"); pipelineState.phase = "verifying";
    const rt = getCoverageTiles(world, dimension), rg = findGapTiles(rt.tiles);
    const tp = (rg.maxX-rg.minX+1)*(rg.maxZ-rg.minZ+1), cpct = tp > 0 ? ((rt.tiles.length/tp)*100).toFixed(1) : "100";
    pLog(`Coverage: ${cpct}%`);
    if (!rg.gaps.length) { pipelineState.phase = "done"; pipelineState.coverage = cpct; return; }
    pipelineState.phase = "filling_gaps"; pLog(`${rg.gaps.length} gaps - filling...`);
    const PAD2 = 512, BPT2 = 256;
    const fa = { x: rg.minX*BPT2-PAD2, z: rg.minZ*BPT2-PAD2, width: (rg.maxX+1)*BPT2+PAD2-(rg.minX*BPT2-PAD2), height: (rg.maxZ+1)*BPT2+PAD2-(rg.minZ*BPT2-PAD2) };
    const { args: fa2 } = buildUnminedArgs({ world, dimension, area: fa });
    await new Promise((resolve, reject) => { const p = spawn(CONFIG.unminedCli, fa2, { cwd: path.dirname(CONFIG.unminedCli) }); p.stdout.on("data",()=>{}); p.stderr.on("data",()=>{}); p.once("close", c => c===0?resolve():reject(new Error("Fill exit "+c))); p.once("error",reject); });
    const nr = getCoverageTiles(world, dimension), ng2 = findGapTiles(nr.tiles);
    pipelineState.phase = "done"; pipelineState.coverage = tp > 0 ? ((nr.tiles.length/tp)*100).toFixed(1) : "100"; pipelineState.remainingGaps = ng2.gaps.length;
    broadcastBdsEvent("pipeline_done", { coverage: pipelineState.coverage, tiles: nr.tiles.length });
  } catch (err) { pipelineState.phase = "error"; pipelineState.error = err.message; pLog("ERROR: " + err.message); }
});
app.get("/api/history", (req, res) => { res.json(loadHistory()); });
app.get("/api/config", (req, res) => { res.json({ bdsWorldsPath: CONFIG.bdsWorldsPath, outputBase: CONFIG.outputBase, unminedFound: fs.existsSync(CONFIG.unminedCli) }); });
app.get("/api/server-info", (req, res) => {
  let ip = null;
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254')) { ip = net.address; break; }
      }
      if (ip) break;
    }
  } catch {}
  let port = 19132;
  try { const props = fs.readFileSync(path.join(CONFIG.bdsCwd, 'server.properties'), 'utf-8'); const m = props.match(/^server-port=(\d+)/m); if (m) port = parseInt(m[1]); } catch {}
  res.json({ ip: ip || '127.0.0.1', port, bdsRunning: bdsProcess !== null });
});
app.get("/api/system/stats", (req, res) => {
  const tm = os.totalmem(), fm = os.freemem(), um = tm-fm, cpu = getCpuUsage(), cpus = os.cpus(), pm = process.memoryUsage();
  res.json({ cpu: { percent: cpu, model: cpus[0]?.model?.trim()||"Unknown", cores: cpus.length }, memory: { total: tm, used: um, free: fm, percent: Math.round((um/tm)*100) }, process: { rss: pm.rss, heapUsed: pm.heapUsed, heapTotal: pm.heapTotal, uptime: Math.floor(process.uptime()) }, bds: bdsProcess ? { pid: bdsProcess.pid } : null, platform: os.platform(), hostname: os.hostname() });
});
function gracefulShutdown(signal) {
  console.log(`\n[Server] ${signal}. Shutting down...`);
  if (activeRender && activeRender.proc) { try { activeRender.proc.kill(); } catch {} activeRender = null; }
  for (const i of sseClients) clearInterval(i); sseClients.clear(); stopAutoRegen();
  if (bdsProcess) { try { bdsProcess.stdin.write("stop\n"); } catch {} setTimeout(() => { if (bdsProcess) { try { bdsProcess.kill(); } catch {} bdsProcess = null; } for (const c of bdsClients) { try { c.end(); } catch {} } bdsClients.clear(); process.exit(0); }, 3000); }
  else { for (const c of bdsClients) { try { c.end(); } catch {} } bdsClients.clear(); process.exit(0); }
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (err) => { console.error("[FATAL] Uncaught:", err.message, err.stack); });
process.on("unhandledRejection", (reason) => { console.error("[FATAL] Rejection:", reason); });

// -- BDS Console --
app.get("/api/bds/status", (req, res) => { res.json({ running: bdsProcess !== null, pid: bdsProcess?.pid || null, logCount: bdsLogs.length }); });
app.post("/api/bds/start", (req, res) => {
  if (bdsProcess) return res.json({ status: "already_running", pid: bdsProcess.pid });
  if (!fs.existsSync(CONFIG.bdsExe)) return res.status(404).json({ error: "BDS not found" });
  bdsLogs = [];
  try { bdsProcess = spawn(CONFIG.bdsExe, [], { cwd: CONFIG.bdsCwd, stdio: ["pipe","pipe","pipe"] }); }
  catch (e) { return res.status(500).json({ error: e.message }); }
  bdsAppendLog("[Dashboard] BDS server starting...");
  bdsReady = false;
  bdsProcess.stdout.on("data", (data) => {
    for (const line of data.toString().split("\n").filter(l => l.trim())) {
      bdsAppendLog(line);
      if (!bdsReady && line.includes("Server started")) { bdsReady = true; bdsAppendLog("[Dashboard] BDS ready."); }
    }
  });
  bdsProcess.stderr.on("data", (data) => {
    for (const line of data.toString().split("\n").filter(l => l.trim())) {
      if (pregenState.active) {
        if (line.includes("[PreGen] Complete!") || line.includes("[PG:DONE]") || line.includes("[PreGen] DONE!")) {
          pregenState.active = false; pregenState.pct = 100;
          saveCoverage(pregenState.dimension || "overworld");
          if (coverageSaveTimer) { clearInterval(coverageSaveTimer); coverageSaveTimer = null; }
          broadcastBdsEvent("pregen_done"); disconnectPregenBots();
        }
        if (line.includes("[PreGen] Cancelled") || line.includes("[PreGen] STOPPED")) {
          pregenState.active = false; saveCoverage(pregenState.dimension || "overworld");
          if (coverageSaveTimer) { clearInterval(coverageSaveTimer); coverageSaveTimer = null; }
          broadcastBdsEvent("pregen_done"); disconnectPregenBots();
        }
        if (line.includes("[PG:SAVE]") || line.includes("[PG:FLUSH]")) {
          bdsAppendLog("[Dashboard] Save requested by PreGen");
          if (bdsProcess) { try { bdsProcess.stdin.write("save hold\n"); setTimeout(() => { if (bdsProcess) { try { bdsProcess.stdin.write("save resume\n"); } catch {} bdsAppendLog("[Dashboard] World saved"); } }, 2000); } catch (e) { bdsAppendLog("[Dashboard] Save failed: " + e.message); } }
        }
        const spM = line.match(/\[PG:SP\]\s*(\d+),(-?\d+),(-?\d+)/);
        if (spM) broadcastBdsEvent("pregen_sprint", { bot: parseInt(spM[1]), x: parseInt(spM[2]), z: parseInt(spM[3]) });
        const zdM = line.match(/\[PG:ZD\]\s*(-?\d+),(-?\d+),(-?\d+),(-?\d+)/);
        if (zdM) broadcastBdsEvent("pregen_zone", { zx: parseInt(zdM[1]), zz: parseInt(zdM[2]), xe: parseInt(zdM[3]), ze: parseInt(zdM[4]) });
        const roM = line.match(/\[PG:RO\]\s*(-?\d+),(-?\d+)/);
        if (roM) broadcastBdsEvent("pregen_chunk", { x: parseInt(roM[1]), z: parseInt(roM[2]), retry: true });
        if (line.includes("[PreGen] SPRINT:")) broadcastBdsEvent("pregen_phase", { phase: "SPRINT" });
        if (line.includes("[PreGen] VERIFY:")) broadcastBdsEvent("pregen_phase", { phase: "VERIFY" });
        if (line.includes("[PreGen] RETRY:") || line.includes("Retry pass")) broadcastBdsEvent("pregen_phase", { phase: "RETRY" });
        const rnM = line.match(/\[PG:RN\]\s*(\d+),(\d+),(-?\d+),(-?\d+),(\d+),(\d+)/);
        if (rnM) {
          const ring = parseInt(rnM[1]), totalRings = parseInt(rnM[2]), posDone = parseInt(rnM[5]), posTotal = parseInt(rnM[6]);
          const ringPct = posTotal > 0 ? Math.round((posDone/posTotal)*100) : 0;
          const overallPct = Math.round(((ring-1+ringPct/100)/totalRings)*10000)/100;
          pregenState.pct = overallPct; pregenState.chunksDone = posDone; pregenState.totalChunks = posTotal; pregenState.phase = `RING ${ring}/${totalRings}`;
          broadcastBdsEvent("pregen_progress", { pct: overallPct, chunksDone: posDone, totalChunks: posTotal, phase: `RING ${ring}/${totalRings}` });
        }
      }
      // ALWAYS parse PG:* markers
      const cfgM2 = line.match(/\[PG:CFG\]\s*(-?\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/);
      if (cfgM2) {
        pregenState.halfGrid = parseInt(cfgM2[1]); pregenState.step = parseInt(cfgM2[2]);
        if (!pregenState.active) { pregenState.active = true; pregenState.startTime = Date.now(); pregenState.totalChunks = parseInt(cfgM2[6]); }
        const dimId = pregenState.dimension || "overworld"; const cov = loadCoverage(dimId);
        cov.step = parseInt(cfgM2[2]); cov.halfGrid = parseInt(cfgM2[1]); cov.radius = cov.halfGrid * cov.step;
        if (!coverageSaveTimer) coverageSaveTimer = setInterval(() => saveCoverage(dimId), 30000);
        broadcastBdsEvent("pregen_config", { halfGrid: parseInt(cfgM2[1]), step: parseInt(cfgM2[2]), sprintStep: parseInt(cfgM2[3]), zone: parseInt(cfgM2[4]), botCount: parseInt(cfgM2[5]), total: parseInt(cfgM2[6]) });
      }
      const dimM = line.match(/\[PG:DIM\]\s*(\S+)/); if (dimM) pregenState.dimension = dimM[1];
      const posM2 = line.match(/\[PG:POS\]\s*(-?\d+),(-?\d+)/);
      if (posM2) { const x = parseInt(posM2[1]), z = parseInt(posM2[2]); broadcastBdsEvent("pregen_sprint", { x, z, bot: 0 }); broadcastBdsEvent("pregen_chunk", { x, z }); addPregenPos(pregenState.dimension || "overworld", x, z, false); }
      const sprintM2 = line.match(/\[PG:SPRINT\]\s*(-?\d+),(-?\d+)/);
      if (sprintM2) { broadcastBdsEvent("pregen_sprint", { x: parseInt(sprintM2[1]), z: parseInt(sprintM2[2]), bot: 0 }); }
      const failM3 = line.match(/\[PG:FAIL\]\s*(-?\d+),(-?\d+)/);
      if (failM3) { const fx = parseInt(failM3[1]), fz = parseInt(failM3[2]); broadcastBdsEvent("pregen_chunk", { x: fx, z: fz, fail: true }); addPregenPos(pregenState.dimension || "overworld", fx, fz, true); }
      const rnM2 = line.match(/\[PG:RN\]\s*(\d+),(\d+),(-?\d+),(-?\d+),(\d+),(\d+)/);
      if (rnM2) { const pd = parseInt(rnM2[5]), pt = parseInt(rnM2[6]); pregenState.chunksDone = pd; pregenState.totalChunks = pt; pregenState.pct = pt > 0 ? Math.round((pd/pt)*10000)/100 : 0; broadcastBdsEvent("pregen_progress", { pct: pregenState.pct, chunksDone: pd, totalChunks: pt }); }
      bdsAppendLog("[STDERR] " + line);
    }
  });
  bdsProcess.on("close", (code) => { bdsAppendLog(`[Dashboard] BDS stopped (code ${code})`); bdsProcess = null; });
  bdsProcess.on("error", (err) => { bdsAppendLog(`[Dashboard] BDS error: ${err.message}`); bdsProcess = null; });
  res.json({ status: "started", pid: bdsProcess.pid });
});
app.post("/api/bds/stop", (req, res) => {
  if (!bdsProcess) return res.json({ status: "not_running" });
  bdsAppendLog("[Dashboard] Stopping BDS...");
  try { bdsProcess.stdin.write("stop\n"); } catch {}
  const pid = bdsProcess.pid;
  setTimeout(() => { if (bdsProcess) { try { bdsProcess.kill(); } catch {} bdsProcess = null; bdsAppendLog("[Dashboard] BDS force killed"); } }, 10000);
  res.json({ status: "stopping", pid });
});
app.post("/api/bds/command", (req, res) => {
  if (!bdsProcess) return res.status(400).json({ error: "BDS not running" });
  const { command } = req.body;
  if (!command) return res.status(400).json({ error: "Command required" });
  try { bdsProcess.stdin.write(command + "\n"); bdsAppendLog(`> ${command}`); res.json({ status: "sent", command }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
app.get("/api/bds/logs", (req, res) => {
  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "X-Accel-Buffering": "no" });
  for (const entry of bdsLogs.slice(-100)) { try { res.write(`data: ${JSON.stringify(entry)}\n\n`); } catch {} }
  bdsClients.add(res); req.on("close", () => bdsClients.delete(res));
});
app.get("/api/bds/logs/history", (req, res) => { const limit = Math.min(parseInt(req.query.limit)||100, 500); res.json(bdsLogs.slice(-limit)); });
// -- Pregen Bots --
function connectSingleBot(username) {
  try {
    const bedrock = require("bedrock-protocol");
    const bot = bedrock.createClient({ host: "127.0.0.1", port: 19132, username, offline: true, skipPing: true });
    bot._username = username;
    let spawned = false;
    const onSpawn = () => {
      if (spawned) return;
      spawned = true;
      console.log(`[PreGen] Bot ${username} SPAWNED via event`);
      setTimeout(() => {
        try { bot.queue("command_request", { command: "gamemode creative", internal: false, version: 52, origin: { type: "player", uuid: "", request_id: "" } }); } catch {}
      }, 2000);
    };
    bot.on("spawn", onSpawn);
    bot.on("respawn", onSpawn);
    bot.on("play_status", (packet) => { console.log(`[PreGen] Bot ${username} play_status: ${JSON.stringify(packet)}`); });
    bot.on("error", (e) => { console.warn(`[PreGen] Bot ${username} error: ${e.message}`); });
    bot.on("close", () => { console.log(`[PreGen] Bot ${username} disconnected`); });
    // Safety: if no spawn event after 30s, bot might be stuck — log it
    setTimeout(() => { if (!spawned) console.warn(`[PreGen] Bot ${username} still not spawned after 30s`); }, 30000);
    return bot;
  } catch (e) { console.error("[PreGen] Bot error:", e.message); return null; }
}
function connectPregenBots(count = 1) { disconnectPregenBots(); const b = connectSingleBot("jokowi"); if (b) pregenBots.push(b); return pregenBots.length; }
function disconnectPregenBots() { for (const b of pregenBots) { try { b.close(); } catch {} } pregenBots = []; }
app.get("/api/pregen/coverage/:dimension", (req, res) => {
  const dim = req.params.dimension || "overworld"; const cov = loadCoverage(dim);
  const completedArr = [...cov.completed].map(k => { const [cx,cz] = k.split(",").map(Number); return { x: cx*16, z: cz*16 }; });
  const failedArr = [...cov.failed].map(k => { const [cx,cz] = k.split(",").map(Number); return { x: cx*16, z: cz*16 }; });
  res.json({ dimension: dim, step: cov.step, radius: cov.radius, halfGrid: cov.halfGrid, completed: completedArr.length, failed: failedArr.length, chunks: completedArr.slice(0, 5000), failedChunks: failedArr.slice(0, 1000), updatedAt: cov.updatedAt });
});
app.delete("/api/pregen/coverage/:dimension", (req, res) => {
  const dim = req.params.dimension || "overworld";
  pregenCoverage[dim] = { step: 32, radius: 0, halfGrid: 0, completed: new Set(), failed: new Set(), updatedAt: Date.now() };
  saveCoverage(dim); res.json({ status: "cleared", dimension: dim });
});
app.get("/api/pregen/status", (req, res) => {
  res.json({ active: pregenState.active, pct: pregenState.pct, chunksDone: pregenState.chunksDone, totalChunks: pregenState.totalChunks, radius: pregenState.radius, dimension: pregenState.dimension, startTime: pregenState.startTime, botCount: pregenBots.length, bdsRunning: bdsProcess !== null });
});
app.post("/api/pregen/start", async (req, res) => {
  if (pregenState.active) return res.status(409).json({ error: "PreGen already running" });
  if (!bdsProcess) return res.status(400).json({ error: "BDS not running" });
  const { radius = 1000, dimension = "overworld", botCount = 1 } = req.body;
  const clampedRadius = Math.min(Math.max(radius, 100), 30000);
  const dimId = dimension === "nether" ? "nether" : dimension === "the_end" ? "the_end" : "overworld";
  pregenState.active = true; pregenState.pct = 0; pregenState.chunksDone = 0; pregenState.totalChunks = 0;
  pregenState.radius = clampedRadius; pregenState.dimension = dimId; pregenState.startTime = Date.now();
  const connected = connectPregenBots(Math.min(botCount, 4)); pregenState.botCount = connected;
  bdsAppendLog(`[PreGen] Starting radius=${clampedRadius}, dim=${dimId}, bots=${connected}`);
  bdsAppendLog("[PreGen] Waiting for bot to fully spawn (1-3 min)...");
  const spawnWatcher = setInterval(() => {
    const recentLogs = bdsLogs.slice(-30).map(e => e.text).join("\n");
    if (recentLogs.includes("Player Spawned")) {
      clearInterval(spawnWatcher);
      bdsAppendLog("[PreGen] Bot spawned! Setting Spectator + sending scriptevent...");
      sendBdsCommand("gamemode spectator @a");
      // Give 2s for gamemode to apply before scriptevent
      setTimeout(() => {
        sendBdsCommand(`scriptevent lt:pregen ${clampedRadius}`);
        bdsAppendLog("[PreGen] scriptevent sent");
      }, 2000);
    }
  }, 3000);
  // Safety: timeout after 5 minutes
  setTimeout(() => {
    clearInterval(spawnWatcher);
    // If still no spawn, try anyway
    if (pregenState.active) {
      bdsAppendLog("[PreGen] Spawn timeout - sending scriptevent anyway");
      sendBdsCommand("gamemode spectator @a");
      sendBdsCommand(`scriptevent lt:pregen ${clampedRadius}`);
    }
  }, 300000);
  res.json({ status: "started", radius: clampedRadius, dimension: dimId, botCount: pregenBots.length });
});
app.post("/api/pregen/stop", (req, res) => {
  if (!pregenState.active) return res.json({ status: "not_running" });
  sendBdsCommand("scriptevent lt:pregen stop"); bdsAppendLog("[PreGen] Stop command sent");
  pregenState.active = false; saveCoverage(pregenState.dimension || "overworld");
  if (coverageSaveTimer) { clearInterval(coverageSaveTimer); coverageSaveTimer = null; }
  broadcastBdsEvent("pregen_done"); res.json({ status: "stopped" });
});
app.listen(PORT, () => {
  console.log(`\n  Laughtale Map Renderer Dashboard`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Unmined: ${fs.existsSync(CONFIG.unminedCli) ? "OK" : "MISSING"}`);
  console.log(`  BDS: ${fs.existsSync(CONFIG.bdsExe) ? "OK" : "MISSING"}`);
  console.log(`  Worlds: ${CONFIG.bdsWorldsPath}\n`);
});
