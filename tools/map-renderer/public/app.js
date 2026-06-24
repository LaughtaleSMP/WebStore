// ============================================================
// Laughtale Map Renderer Ã¢â‚¬â€ Frontend Logic
// ============================================================

// Ã¢â€â‚¬Ã¢â€â‚¬ State Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
let worlds = [];
let selectedWorld = null;
let currentDimension = "overworld";
let map = null;
let tileLayer = null;
let eventSource = null;
let isRendering = false;
let doneHandled = false;
let sseReconnectTimer = null;
let gridLayer = null;
let gridVisible = false;
let pregenLayer = null;
let pregenMarker = null;
let pregenGridConfig = null;

// Ã¢â€â‚¬Ã¢â€â‚¬ Initialize Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadWorlds();
  loadHistory();
  connectSSE();
  checkBdsStatus();     // Check if BDS is already running
  connectBdsSSE();      // Connect SSE early for render_done events
  startSystemMonitor(); // System resource monitoring
});

// Pause SSE when tab is hidden to save resources
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  } else {
    if (!eventSource) connectSSE();
  }
});

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// MAP Ã¢â‚¬â€ Leaflet.js
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
function initMap() {
  map = L.map("map", {
    crs: L.CRS.Simple,
    minZoom: -6,
    maxZoom: 4,
    zoomControl: false,
    attributionControl: false,
  });

  // Zoom controls top-right (avoid overlap with coords)
  L.control.zoom({ position: "topright" }).addTo(map);

  map.setView([0, 0], -2);

  // Track mouse position Ã¢â€ â€™ update coordinate HUD
  map.on("mousemove", (e) => {
    document.getElementById("coordX").textContent = Math.round(e.latlng.lng);
    document.getElementById("coordZ").textContent = Math.round(e.latlng.lat);
  });

  // Track zoom level
  map.on("zoomend", () => {
    document.getElementById("coordZoom").textContent = map.getZoom();
  });
}

async function loadTiles(worldName, dimension) {
  if (tileLayer) {
    map.removeLayer(tileLayer);
    tileLayer = null;
  }

  // Fetch map properties from Unmined
  let props = {
    minZoom: -6, maxZoom: 0,
    minRegionX: -10, maxRegionX: 10,
    minRegionZ: -10, maxRegionZ: 10,
  };
  try {
    const res = await fetch(`/api/map-props/${encodeURIComponent(worldName)}/${encodeURIComponent(dimension)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.exists) props = { ...props, ...data };
    }
  } catch { /* use defaults */ }

  // Use tile proxy URL with cache buster
  const cacheBuster = Date.now();
  const tilePath = `/tile/${encodeURIComponent(worldName)}/${encodeURIComponent(dimension)}/{z}/{x}/{y}?v=${cacheBuster}`;

  tileLayer = L.tileLayer(tilePath, {
    minZoom: props.minZoom,
    maxZoom: props.maxZoom + 4,       // Allow zooming 4 levels beyond native
    maxNativeZoom: props.maxZoom,      // Tiles only exist up to this zoom
    minNativeZoom: props.minZoom,      // Tiles only exist from this zoom
    tileSize: 256,
    noWrap: true,
    errorTileUrl: "",
  });

  tileLayer.addTo(map);

  // Hide overlay
  document.getElementById("mapOverlay").classList.add("hidden");

  // Set initial view Ã¢â‚¬â€ clamp zoom between min and max
  const initialZoom = Math.max(props.minZoom, Math.min(props.maxZoom, props.minZoom + 2));
  map.setView([0, 0], initialZoom);
}

function showMapImage(worldName) {
  if (tileLayer) {
    map.removeLayer(tileLayer);
    tileLayer = null;
  }

  const imgUrl = `/tiles/map_${worldName.toLowerCase()}.png`;

  const img = new Image();
  img.onload = () => {
    const h = img.height;
    const w = img.width;
    const bounds = [[-h / 2, -w / 2], [h / 2, w / 2]];
    tileLayer = L.imageOverlay(imgUrl, bounds);
    tileLayer.addTo(map);
    map.fitBounds(bounds);
    document.getElementById("mapOverlay").classList.add("hidden");
  };
  img.onerror = () => {
    document.getElementById("mapOverlay").classList.remove("hidden");
  };
  img.src = imgUrl;
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// WORLDS Ã¢â‚¬â€ Load & Display
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
async function loadWorlds() {
  try {
    const res = await fetch("/api/worlds");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    worlds = data.worlds || [];
    renderWorldList();
  } catch (e) {
    console.error("Failed to load worlds:", e);
    document.getElementById("worldList").innerHTML =
      '<div class="loading-placeholder">Error loading worlds</div>';
  }
}

function renderWorldList() {
  const container = document.getElementById("worldList");
  if (worlds.length === 0) {
    container.innerHTML = '<div class="loading-placeholder">No worlds found</div>';
    return;
  }

  container.innerHTML = worlds.map((w) => {
    const renderCount = Object.values(w.renders).filter((r) => r.rendered).length;
    const isActive = selectedWorld === w.name;

    // Escape world name for safe HTML/JS injection
    const safeName = escapeHtml(w.name);
    const safeAttrName = w.name.replace(/'/g, "\\'");

    return `
      <div class="world-card ${isActive ? "active" : ""}" onclick="selectWorld('${safeAttrName}')">
        <div class="world-name">${safeName}</div>
        <div class="world-meta">
          <span class="badge size">${w.dbSizeMB} MB</span>
          ${renderCount > 0
            ? `<span class="badge rendered">${renderCount}/3 rendered</span>`
            : '<span class="badge unrendered">Not rendered</span>'
          }
          ${w.hasImage ? '<span class="badge rendered">IMG</span>' : ""}
        </div>
      </div>
    `;
  }).join("");
}

function selectWorld(name) {
  selectedWorld = name;
  renderWorldList();

  // Update UI
  document.getElementById("worldTitle").textContent = name;
  document.getElementById("btnRenderWeb").disabled = false;
  document.getElementById("btnRenderImage").disabled = false;
  document.getElementById("btnSafeRender").disabled = false;
  document.getElementById("btnCoverage").disabled = false;
  document.getElementById("btnFillGaps").disabled = false;

  // Update info bar
  const world = worlds.find((w) => w.name === name);
  if (world) {
    document.getElementById("infoWorld").textContent = name;
    updateDimensionInfo(world);
  }

  // Load map for current dimension
  loadWorldMap(name, currentDimension);
}

function loadWorldMap(worldName, dimension) {
  const world = worlds.find((w) => w.name === worldName);
  if (!world) return;

  const renderInfo = world.renders[dimension];

  if (renderInfo && renderInfo.rendered) {
    loadTiles(worldName, dimension);
  } else if (dimension === "overworld" && world.hasImage) {
    showMapImage(worldName);
  } else {
    // No render Ã¢â‚¬â€ show overlay
    document.getElementById("mapOverlay").classList.remove("hidden");
    if (tileLayer) {
      map.removeLayer(tileLayer);
      tileLayer = null;
    }
  }
}

function updateDimensionInfo(world) {
  const dimInfo = world.renders[currentDimension];
  const dimLabel = { overworld: "Overworld", nether: "Nether", end: "The End" };

  document.getElementById("infoDimension").textContent = dimLabel[currentDimension] || currentDimension;
  document.getElementById("infoTiles").textContent = dimInfo?.rendered
    ? `${dimInfo.tileCount} tiles`
    : "Not rendered";
  document.getElementById("infoLastRender").textContent = dimInfo?.lastModified
    ? `Last: ${formatDate(dimInfo.lastModified)}`
    : "\u2014"; // em dash
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// DIMENSION SWITCHING
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
function switchDimension(dim) {
  if (!["overworld", "nether", "end"].includes(dim)) return;
  currentDimension = dim;

  // Update tab styling
  document.querySelectorAll(".dim-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.dim === dim);
  });

  if (selectedWorld) {
    const world = worlds.find((w) => w.name === selectedWorld);
    if (world) updateDimensionInfo(world);
    loadWorldMap(selectedWorld, dim);
  }

  // Refresh pregen coverage overlay if visible
  if (pregenCoverageVisible) {
    pregenCoverageVisible = false; // force toggle to re-fetch
    togglePregenCoverage();
  }
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// SAFE RENDER PIPELINE Ã¢â‚¬â€ 1 click automated pipeline
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
async function startSafeRender() {
  if (!selectedWorld || isRendering) return;

  const btn = document.getElementById("btnSafeRender");
  btn.disabled = true;
  btn.textContent = "Starting...";

  try {
    const res = await fetch("/api/pipeline/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ world: selectedWorld, dimension: currentDimension }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "Pipeline gagal dimulai", "error");
      btn.disabled = false;
      btn.textContent = "Safe Render";
      return;
    }

    isRendering = true;
    btn.textContent = "Pipeline...";
    showToast("Safe Render dimulai Ã¢â‚¬â€ lihat BDS Console untuk progress", "success");

    // Poll pipeline status
    const pollId = setInterval(async () => {
      try {
        const sr = await fetch("/api/pipeline/status");
        const st = await sr.json();
        const phases = {
          init: "Initializing...",
          stopping_bds: "Stopping BDS...",
          compacting: "Compacting WAL...",
          rendering: "Rendering...",
          verifying: "Verifying coverage...",
          filling_gaps: "Filling gaps...",
          done: "Done!",
          error: "Error!",
        };
        btn.textContent = phases[st.phase] || st.phase;

        if (st.phase === "done") {
          clearInterval(pollId);
          isRendering = false;
          btn.disabled = false;
          btn.textContent = "Safe Render";
          const cov = st.coverage || "100";
          const gaps = st.remainingGaps || 0;
          showToast(
            gaps === 0
              ? "Safe Render selesai! Coverage " + cov + "%"
              : "Render selesai Ã¢â‚¬â€ " + gaps + " gap (chunk belum di-generate)",
            gaps === 0 ? "success" : "info"
          );
          // Reload tiles
          if (typeof loadMapTiles === "function") loadMapTiles();
        } else if (st.phase === "error") {
          clearInterval(pollId);
          isRendering = false;
          btn.disabled = false;
          btn.textContent = "Safe Render";
          showToast("Pipeline error: " + (st.error || "unknown"), "error");
        }
      } catch {}
    }, 2000);
  } catch (e) {
    showToast("Network error", "error");
    btn.disabled = false;
    btn.textContent = "Safe Render";
  }
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// RENDER Ã¢â‚¬â€ Start / Cancel
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
async function startRender(mode) {
  if (!selectedWorld || isRendering) return;
  if (!["web", "image"].includes(mode)) return;

  doneHandled = false;

  try {
    const areaRadius = parseInt(document.getElementById("renderArea")?.value) || 0;

    const res = await fetch("/api/render", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        world: selectedWorld,
        dimension: currentDimension,
        mode,
        areaRadius,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || "Render gagal dimulai", "error");
      return;
    }

    const result = await res.json();

    // Immediately show progress UI
    isRendering = true;
    showRenderUI(true);

    // Set initial progress text
    document.getElementById("progressLabel").textContent =
      result.message || `Rendering ${selectedWorld}...`;
    document.getElementById("progressPct").textContent = "0%";
    document.getElementById("progressFill").style.width = "0%";
    document.getElementById("progressGlow").style.width = "0%";
    document.getElementById("progressLog").innerHTML =
      `<div>Starting ${escapeHtml(mode)} render for ${escapeHtml(selectedWorld)} (${escapeHtml(currentDimension)})...</div>`;

    showToast(`Render dimulai: ${selectedWorld} (${currentDimension})`, "info");
  } catch (e) {
    showToast("Koneksi error: " + e.message, "error");
  }
}

async function cancelRender() {
  try {
    await fetch("/api/render/cancel", { method: "POST" });
    isRendering = false;
    doneHandled = false;
    showRenderUI(false);
    showToast("Render dibatalkan", "info");

    // Reset fill gaps state if it was running
    if (fillGapsActive) {
      fillGapsActive = false;
      resetFillGapsBtn();
    }
  } catch (e) {
    console.error("Cancel failed:", e);
  }
}

function showRenderUI(rendering) {
  document.getElementById("progressSection").style.display = rendering ? "block" : "none";
  document.getElementById("btnCancel").style.display = rendering ? "inline-flex" : "none";
  document.getElementById("btnRenderWeb").disabled = rendering;
  document.getElementById("btnRenderImage").disabled = rendering;

  const dot = document.querySelector("#statusDot .dot");
  const statusText = document.getElementById("statusText");

  if (rendering) {
    dot.className = "dot rendering";
    statusText.textContent = "Rendering...";
  } else {
    dot.className = "dot idle";
    statusText.textContent = "Ready";
  }
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// PROGRESS Ã¢â‚¬â€ SSE (Server-Sent Events)
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
function connectSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }

  if (sseReconnectTimer) {
    clearTimeout(sseReconnectTimer);
    sseReconnectTimer = null;
  }

  eventSource = new EventSource("/api/render/progress");

  eventSource.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return; // Skip malformed data
    }

    if (data.phase === "idle") {
      if (isRendering && doneHandled) {
        // Done was already handled, just clean up
        isRendering = false;
        showRenderUI(false);
      } else if (isRendering && !doneHandled) {
        // Render finished but we missed the "done" event
        doneHandled = true;
        isRendering = false;
        showRenderUI(false);
        loadWorlds().then(() => {
          if (selectedWorld) loadWorldMap(selectedWorld, currentDimension);
        });
        loadHistory();
      }
      return;
    }

    // Active render detected
    if (!isRendering) {
      isRendering = true;
      doneHandled = false;
      showRenderUI(true);
    }

    updateProgress(data);
  };

  eventSource.onerror = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    // Reconnect with backoff
    sseReconnectTimer = setTimeout(connectSSE, 3000);
  };
}

function updateProgress(data) {
  const pct = Math.min(100, Math.max(0, Math.round(data.progress || 0)));

  document.getElementById("progressPct").textContent = `${pct}%`;
  document.getElementById("progressFill").style.width = `${pct}%`;
  document.getElementById("progressGlow").style.width = `${pct}%`;

  // Phase label
  const phaseLabels = {
    scanning: "Scanning world...",
    rendering: `Rendering ${escapeHtml(data.world || "")} \u2014 ${escapeHtml(data.dimension || "")}`,
    "zoom-out": "Generating zoom levels...",
    saving: "Saving output...",
    done: "Render selesai!",
    error: "Error!",
  };
  document.getElementById("progressLabel").textContent =
    phaseLabels[data.phase] || data.phase || "Processing...";

  // Details
  if (data.totalRegions > 0) {
    document.getElementById("progressRegions").textContent =
      `Region: ${data.currentRegion}/${data.totalRegions}`;
  }

  if (data.speed) {
    document.getElementById("progressSpeed").textContent =
      `${data.speed} chunks/s`;
  }

  if (data.elapsed && data.progress > 0) {
    const eta = Math.round((data.elapsed / data.progress) * (100 - data.progress));
    document.getElementById("progressEta").textContent =
      `ETA: ${formatMs(eta)}`;
  }

  // Log
  if (data.lastLog && data.lastLog.length > 0) {
    document.getElementById("progressLog").innerHTML = data.lastLog
      .map((l) => `<div>${escapeHtml(l)}</div>`)
      .join("");
  }

  // Handle completion Ã¢â‚¬â€ ONCE only
  if (data.phase === "done" && !doneHandled) {
    doneHandled = true;
    const dot = document.querySelector("#statusDot .dot");
    dot.className = "dot idle";
    document.getElementById("statusText").textContent = "Complete";
    document.getElementById("progressPct").textContent = "100%";
    document.getElementById("progressFill").style.width = "100%";
    document.getElementById("progressGlow").style.width = "100%";
    document.getElementById("progressLabel").textContent = "Render selesai!";

    showToast(`Render selesai: ${data.world || ""} (${data.dimension || ""})`, "success");

    setTimeout(() => {
      isRendering = false;
      showRenderUI(false);
      loadWorlds().then(() => {
        if (selectedWorld) loadWorldMap(selectedWorld, currentDimension);
      });
      loadHistory();
    }, 3000);
  } else if (data.phase === "error" && !doneHandled) {
    doneHandled = true;
    const dot = document.querySelector("#statusDot .dot");
    dot.className = "dot error";
    document.getElementById("statusText").textContent = "Error";
    showToast("Render error! Cek log untuk detail.", "error");
  }
}

function toggleCoverage() {
  if (coverageVisible) {
    hideCoverageOverlay();
    coverageVisible = false;
    document.getElementById("btnCoverage")?.classList.remove("active");
  }
  document.getElementById("coveragePanel").style.display = "none";
}

function drawCoverage(tiles) {
  const canvas = document.getElementById("coverageCanvas");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.fillStyle = "#0a0e17";
  ctx.fillRect(0, 0, W, H);

  if (!tiles || tiles.length === 0) return;

  // Find bounds
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const t of tiles) {
    if (t.x < minX) minX = t.x;
    if (t.x > maxX) maxX = t.x;
    if (t.z < minZ) minZ = t.z;
    if (t.z > maxZ) maxZ = t.z;
  }

  const rangeX = maxX - minX + 1;
  const rangeZ = maxZ - minZ + 1;

  // Prevent division by zero
  if (rangeX <= 0 || rangeZ <= 0) return;

  const scale = Math.min(W / rangeX, H / rangeZ) * 0.9;
  const offsetX = (W - rangeX * scale) / 2;
  const offsetZ = (H - rangeZ * scale) / 2;

  // Draw grid background (skip if too many cells Ã¢â‚¬â€ perf)
  if (rangeX * rangeZ < 10000) {
    ctx.fillStyle = "rgba(56, 68, 90, 0.15)";
    for (let x = minX; x <= maxX; x++) {
      for (let z = minZ; z <= maxZ; z++) {
        const px = (x - minX) * scale + offsetX;
        const pz = (z - minZ) * scale + offsetZ;
        ctx.fillRect(px, pz, Math.max(1, scale - 0.5), Math.max(1, scale - 0.5));
      }
    }
  }

  // Draw rendered tiles
  const dimColors = {
    overworld: "#00e5ff",
    nether: "#ff6b35",
    end: "#c084fc",
  };
  ctx.fillStyle = dimColors[currentDimension] || "#00e5ff";

  for (const t of tiles) {
    const px = (t.x - minX) * scale + offsetX;
    const pz = (t.z - minZ) * scale + offsetZ;
    ctx.fillRect(px, pz, Math.max(1, scale - 0.5), Math.max(1, scale - 0.5));
  }

  // Draw center crosshair
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.lineWidth = 0.5;
  const cx = (0 - minX) * scale + offsetX;
  const cz = (0 - minZ) * scale + offsetZ;
  ctx.beginPath();
  ctx.moveTo(cx, 0); ctx.lineTo(cx, H);
  ctx.moveTo(0, cz); ctx.lineTo(W, cz);
  ctx.stroke();
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// TILE COVERAGE OVERLAY Ã¢â‚¬â€ on Leaflet map
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
let coverageLayer = null;
let coverageVisible = false;

async function showCoverage() {
  if (!selectedWorld) return;

  const panel = document.getElementById("coveragePanel");

  // Toggle Ã¢â‚¬â€ if visible, hide
  if (coverageVisible) {
    hideCoverageOverlay();
    panel.style.display = "none";
    coverageVisible = false;
    document.getElementById("btnCoverage")?.classList.remove("active");
    return;
  }

  try {
    const res = await fetch(`/api/coverage/${encodeURIComponent(selectedWorld)}/${encodeURIComponent(currentDimension)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!data.exists || !data.tiles || data.tiles.length === 0) {
      showToast("Belum ada tiles untuk dimensi ini", "info");
      return;
    }

    // Draw mini panel
    panel.style.display = "block";
    drawCoverage(data.tiles);

    // Calculate bounds & stats
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const t of data.tiles) {
      if (t.x < minX) minX = t.x;
      if (t.x > maxX) maxX = t.x;
      if (t.z < minZ) minZ = t.z;
      if (t.z > maxZ) maxZ = t.z;
    }
    const totalPossible = (maxX - minX + 1) * (maxZ - minZ + 1);
    const pct = totalPossible > 0 ? ((data.count / totalPossible) * 100).toFixed(1) : 0;

    document.getElementById("coverageStats").innerHTML =
      `<span>${data.count} tiles</span> <span>|</span> <span>Coverage: ${pct}%</span>`;

    // Draw Leaflet overlay
    drawCoverageOnMap(data.tiles);
    coverageVisible = true;
    document.getElementById("btnCoverage")?.classList.add("active");

    showToast(`Coverage: ${data.count} tiles (${pct}%)`, "info");
  } catch (e) {
    showToast("Gagal memuat coverage", "error");
  }
}

function drawCoverageOnMap(tiles) {
  hideCoverageOverlay();

  if (!tiles || tiles.length === 0 || !map) return;

  // Create a tile set for O(1) lookup
  const tileSet = new Set(tiles.map(t => `${t.x},${t.z}`));

  // Find bounds
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const t of tiles) {
    if (t.x < minX) minX = t.x;
    if (t.x > maxX) maxX = t.x;
    if (t.z < minZ) minZ = t.z;
    if (t.z > maxZ) maxZ = t.z;
  }

  // Create a custom grid overlay that colors tiles
  const CoverageGrid = L.GridLayer.extend({
    createTile: function(coords) {
      const tile = document.createElement("canvas");
      const size = this.getTileSize();
      tile.width = size.x;
      tile.height = size.y;

      const ctx = tile.getContext("2d");
      const key = `${coords.x},${coords.y}`;

      if (tileSet.has(key)) {
        // Rendered tile Ã¢â‚¬â€ green tint
        ctx.fillStyle = "rgba(63, 185, 80, 0.15)";
        ctx.fillRect(0, 0, size.x, size.y);
        ctx.strokeStyle = "rgba(63, 185, 80, 0.4)";
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, size.x, size.y);
      } else {
        // Check if in bounds Ã¢â‚¬â€ unrendered = red tint
        if (coords.x >= minX && coords.x <= maxX &&
            coords.y >= minZ && coords.y <= maxZ) {
          ctx.fillStyle = "rgba(248, 81, 73, 0.1)";
          ctx.fillRect(0, 0, size.x, size.y);
          ctx.strokeStyle = "rgba(248, 81, 73, 0.3)";
          ctx.lineWidth = 1;
          ctx.strokeRect(0, 0, size.x, size.y);
        }
      }

      return tile;
    }
  });

  coverageLayer = new CoverageGrid({
    minZoom: -6,
    maxZoom: 4,
    tileSize: 256,
    opacity: 1,
    pane: "overlayPane",
  });

  coverageLayer.addTo(map);
}

function hideCoverageOverlay() {
  if (coverageLayer && map) {
    map.removeLayer(coverageLayer);
    coverageLayer = null;
  }
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// PREGEN COVERAGE OVERLAY Ã¢â‚¬â€ Auto-show during pregen
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
let pregenCoverageLayer = null;
let pregenCoverageVisible = false;

// Auto-show: called when pregen_config event received
async function autoShowPregenCoverage() {
  const panel = document.getElementById("pregenCovPanel");
  const dimMap = { overworld: "overworld", nether: "nether", end: "the_end", the_end: "the_end" };
  const dim = dimMap[currentDimension] || "overworld";

  try {
    const res = await fetch(`/api/pregen/coverage/${dim}`);
    if (!res.ok) return;
    const data = await res.json();
    
    drawPregenCoverageOnMap(data);
    pregenCoverageVisible = true;

    if (panel) {
      panel.style.display = "flex";
      const pct = data.totalExpected > 0
        ? Math.round((data.totalCompleted / data.totalExpected) * 10000) / 100
        : 100;
      panel.innerHTML = `
        <span class="pcov-stat pcov-ok">${data.totalCompleted} chunks OK</span>
        <span class="pcov-stat pcov-fail">${data.totalFailed} Fail</span>
        <span class="pcov-stat pcov-pend">${Math.max(0, data.totalExpected - data.totalCompleted - data.totalFailed)} Pending</span>
        <span class="pcov-stat pcov-pct">${pct}%</span>
      `;
    }
  } catch {}

  // Auto-refresh every 10 seconds while pregen is running
  if (!window._pregenCovRefresh) {
    window._pregenCovRefresh = setInterval(async () => {
      if (!pregenCoverageVisible) {
        clearInterval(window._pregenCovRefresh);
        window._pregenCovRefresh = null;
        return;
      }
      try {
        const res = await fetch(`/api/pregen/coverage/${dim}`);
        if (!res.ok) return;
        const data = await res.json();
        drawPregenCoverageOnMap(data);
        if (panel) {
          const pct = data.totalExpected > 0
            ? Math.round((data.totalCompleted / data.totalExpected) * 10000) / 100
            : 100;
          panel.innerHTML = `
            <span class="pcov-stat pcov-ok">${data.totalCompleted} chunks OK</span>
            <span class="pcov-stat pcov-fail">${data.totalFailed} Fail</span>
            <span class="pcov-stat pcov-pend">${Math.max(0, data.totalExpected - data.totalCompleted - data.totalFailed)} Pending</span>
            <span class="pcov-stat pcov-pct">${pct}%</span>
          `;
        }
      } catch {}
    }, 10000);
  }
}

async function togglePregenCoverage() {
  const btn = document.getElementById("btnPregenCov");
  const panel = document.getElementById("pregenCovPanel");

  if (pregenCoverageVisible) {
    hidePregenCoverage();
    pregenCoverageVisible = false;
    if (btn) btn.classList.remove("active");
    if (panel) panel.style.display = "none";
    return;
  }

  // Map dimension names
  const dimMap = { overworld: "overworld", nether: "nether", end: "the_end", the_end: "the_end" };
  const dim = dimMap[currentDimension] || "overworld";

  try {
    if (btn) btn.classList.add("active");
    const res = await fetch(`/api/pregen/coverage/${dim}`);
    if (!res.ok) throw new Error("API error");
    const data = await res.json();

    if (data.totalExpected === 0 && data.totalCompleted === 0) {
      showToast("No pregen data for this dimension", "info");
      if (btn) btn.classList.remove("active");
      return;
    }

    drawPregenCoverageOnMap(data);
    pregenCoverageVisible = true;

    // Stats panel
    if (panel) {
      panel.style.display = "flex";
      const pct = data.totalExpected > 0
        ? Math.round((data.totalCompleted / data.totalExpected) * 10000) / 100
        : 100;
      panel.innerHTML = `
        <span class="pcov-stat pcov-ok">${data.totalCompleted} chunks OK</span>
        <span class="pcov-stat pcov-fail">${data.totalFailed} Fail</span>
        <span class="pcov-stat pcov-pend">${Math.max(0, data.totalExpected - data.totalCompleted - data.totalFailed)} Pending</span>
        <span class="pcov-stat pcov-pct">${pct}%</span>
      `;
    }

    showToast(`Pregen: ${data.totalCompleted}/${data.totalExpected} chunks (${dim})`, "info");
  } catch (e) {
    showToast("Failed to load pregen coverage", "error");
    if (btn) btn.classList.remove("active");
  }
}

function drawPregenCoverageOnMap(data) {
  // v18: Lightweight adapter Ã¢â‚¬â€ feed coverage data into pgCanvas instead of
  // creating a separate heavy canvas. This eliminates the dual-canvas lag.
  if (!map || !data) return;
  hidePregenCoverage();

  // Ensure pgCanvas is initialized with correct config
  const step = data.step || 32;
  const halfGrid = data.halfGrid || 0;
  if (!pgCanvas.el && halfGrid > 0) {
    pgCanvas.reset();
    pgCanvas.config = { halfGrid, step };
    pgCanvas.init();
  }

  // Feed completed/failed grid-level positions into pgCanvas from coverage data.
  // Coverage stores chunk coords "cx,cz" Ã¢â‚¬â€ we need to deduplicate to grid positions.
  // Grid position = (gx*step, gz*step) Ã¢â€ â€™ chunk coords are (floor(gx*step/16), floor(gz*step/16))
  // Reverse: find which grid positions are covered by looking at completed chunk keys.
  const completedGridKeys = new Set();
  const failedGridKeys = new Set();

  // Build grid position lookup from completed chunks
  for (const key of (data.completed || [])) {
    const [cx, cz] = key.split(",").map(Number);
    if (isNaN(cx) || isNaN(cz)) continue;
    // Find nearest grid position: gx = round(cx*16 / step) * step
    const gx = Math.round((cx * 16) / step) * step;
    const gz = Math.round((cz * 16) / step) * step;
    const gKey = `${gx},${gz}`;
    completedGridKeys.add(gKey);
  }
  for (const key of (data.failed || [])) {
    const [cx, cz] = key.split(",").map(Number);
    if (isNaN(cx) || isNaN(cz)) continue;
    const gx = Math.round((cx * 16) / step) * step;
    const gz = Math.round((cz * 16) / step) * step;
    const gKey = `${gx},${gz}`;
    if (!completedGridKeys.has(gKey)) failedGridKeys.add(gKey);
  }

  // Merge into pgCanvas arrays (avoid duplicates)
  for (const key of completedGridKeys) {
    if (pgCanvas._completedKeys && !pgCanvas._completedKeys.has(key)) {
      const [x, z] = key.split(",").map(Number);
      pgCanvas.completed.push(x, z);
      pgCanvas._completedKeys.add(key);
    }
  }
  for (const key of failedGridKeys) {
    if (pgCanvas._failedKeys && !pgCanvas._failedKeys.has(key)) {
      const [x, z] = key.split(",").map(Number);
      pgCanvas.failed.push(x, z);
      pgCanvas._failedKeys.add(key);
    }
  }
  pgCanvas.dirty = true;

  // Minimal marker Ã¢â‚¬â€ just store a reference so hidePregenCoverage() works
  pregenCoverageLayer = {
    remove() { /* pgCanvas handles its own cleanup */ }
  };
}

function hidePregenCoverage() {
  if (pregenCoverageLayer) {
    pregenCoverageLayer.remove();
    pregenCoverageLayer = null;
  }
  // Stop auto-refresh timer
  if (window._pregenCovRefresh) {
    clearInterval(window._pregenCovRefresh);
    window._pregenCovRefresh = null;
  }
}


// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// CHUNK GRID OVERLAY
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
function toggleChunkGrid() {
  gridVisible = !gridVisible;
  const btn = document.getElementById("btnGrid");

  if (gridVisible) {
    btn.classList.add("active");
    if (!gridLayer) {
      gridLayer = createGridLayer();
    }
    gridLayer.addTo(map);
  } else {
    btn.classList.remove("active");
    if (gridLayer) {
      map.removeLayer(gridLayer);
    }
  }
}

function createGridLayer() {
  const GridOverlay = L.GridLayer.extend({
    createTile: function (coords) {
      const tile = document.createElement("canvas");
      const size = this.getTileSize();
      tile.width = size.x;
      tile.height = size.y;

      const ctx = tile.getContext("2d");
      const zoom = coords.z;

      // Draw sub-grid (8x8 chunks per tile)
      ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
      ctx.lineWidth = 0.5;
      const step = size.x / 8;
      for (let i = 1; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(i * step, 0);
        ctx.lineTo(i * step, size.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i * step);
        ctx.lineTo(size.x, i * step);
        ctx.stroke();
      }

      // Draw tile border (region boundary Ã¢â‚¬â€ bold)
      ctx.strokeStyle = "rgba(0, 229, 255, 0.7)";
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, size.x - 2, size.y - 2);

      // Coordinate label with background
      if (zoom >= -3) {
        const label = `${coords.x}, ${coords.y}`;
        ctx.font = "bold 12px 'JetBrains Mono', monospace";
        const textW = ctx.measureText(label).width;

        // Background
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(4, 2, textW + 8, 18);

        // Text
        ctx.fillStyle = "rgba(0, 229, 255, 0.9)";
        ctx.fillText(label, 8, 15);
      }

      return tile;
    },
  });

  return new GridOverlay({
    minZoom: -6,
    maxZoom: 4,
    tileSize: 256,
    opacity: 1,
    pane: "overlayPane",
  });
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// MAP TOOLS Ã¢â‚¬â€ Spawn, Refresh, Fullscreen
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
function goToSpawn() {
  if (!map) return;
  map.setView([0, 0], 0, { animate: true, duration: 0.5 });
  showToast("Navigasi ke Spawn (0, 0)", "info");
}

function refreshTiles() {
  if (!tileLayer || !selectedWorld) return;

  // Remove and re-add tile layer to force reload
  const currentZoom = map.getZoom();
  const currentCenter = map.getCenter();

  map.removeLayer(tileLayer);
  tileLayer.addTo(map);
  map.setView(currentCenter, currentZoom);

  showToast("Tiles di-refresh!", "info");
}

function toggleFullscreen() {
  const container = document.querySelector(".map-container");
  if (!document.fullscreenElement) {
    container.requestFullscreen().then(() => {
      setTimeout(() => map?.invalidateSize(), 200);
    }).catch(() => {});
  } else {
    document.exitFullscreen();
  }
}

// Fix map sizing after fullscreen change
document.addEventListener("fullscreenchange", () => {
  setTimeout(() => map?.invalidateSize(), 200);
});


// ===============================================================
// FILL GAPS Ã¢â‚¬â€ Auto-detect & re-render missing tiles
// ===============================================================
let fillGapsActive = false;

async function fillGaps() {
  if (!selectedWorld || isRendering || fillGapsActive) return;

  fillGapsActive = true;
  const btn = document.getElementById("btnFillGaps");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
      Analyzing...
    `;
  }

  try {
    // Step 1: Analyze gaps
    const gapRes = await fetch(`/api/render/gaps/${encodeURIComponent(selectedWorld)}/${encodeURIComponent(currentDimension)}`);
    if (!gapRes.ok) throw new Error(`HTTP ${gapRes.status}`);
    const gapData = await gapRes.json();

    if (gapData.gapCount === 0) {
      showToast("Coverage sudah 100%! Tidak ada gap.", "success");
      fillGapsActive = false;
      resetFillGapsBtn();
      return;
    }

    showToast(`Ditemukan ${gapData.gapCount} gap tiles. Memulai re-render...`, "info");

    // Step 2: Trigger fill
    const fillRes = await fetch("/api/render/fill-gaps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        world: selectedWorld,
        dimension: currentDimension,
      }),
    });

    if (!fillRes.ok) {
      const err = await fillRes.json().catch(() => ({}));
      showToast(err.error || "Fill gaps gagal", "error");
      fillGapsActive = false;
      resetFillGapsBtn();
      return;
    }

    const result = await fillRes.json();

    if (result.status === "perfect") {
      showToast(result.message, "success");
      fillGapsActive = false;
      resetFillGapsBtn();
      return;
    }

    // Show progress UI Ã¢â‚¬â€ reuse existing render progress
    isRendering = true;
    doneHandled = false;
    showRenderUI(true);

    document.getElementById("progressLabel").textContent =
      `Filling ${result.gapCount} gap tiles...`;
    document.getElementById("progressPct").textContent = "0%";
    document.getElementById("progressFill").style.width = "0%";
    document.getElementById("progressGlow").style.width = "0%";
    document.getElementById("progressLog").innerHTML =
      `<div>[FillGaps] Mengisi ${result.gapCount} gap tiles (area: ${result.area.width}x${result.area.height} blocks)</div>`;

    // Wait for completion via SSE, then analyze result
    let checkCount = 0;
    const MAX_CHECKS = 3600; // Safety cap: 1 hour max polling
    const checkDone = setInterval(async () => {
      checkCount++;

      // Safety timeout Ã¢â‚¬â€ prevent infinite polling
      if (checkCount >= MAX_CHECKS) {
        clearInterval(checkDone);
        fillGapsActive = false;
        resetFillGapsBtn();
        showToast("Fill gaps timeout Ã¢â‚¬â€ check render status manually", "info");
        return;
      }

      // Completed successfully
      if (!isRendering && doneHandled) {
        clearInterval(checkDone);
        fillGapsActive = false;
        resetFillGapsBtn();

        // Re-check coverage after fill
        try {
          const recheck = await fetch(`/api/render/gaps/${encodeURIComponent(selectedWorld)}/${encodeURIComponent(currentDimension)}`);
          const recheckData = await recheck.json();
          if (recheckData.gapCount === 0) {
            showToast(`Coverage 100%! Semua ${recheckData.totalTiles} tiles lengkap.`, "success");
          } else {
            showToast(`${recheckData.gapCount} gap masih tersisa. Chunks mungkin belum di-generate di world.`, "info");
          }
        } catch { /* silent */ }

        // Refresh map + coverage
        if (selectedWorld) loadWorldMap(selectedWorld, currentDimension);
        if (coverageVisible) {
          hideCoverageOverlay();
          coverageVisible = false;
          showCoverage();
        }
        return;
      }

      // Error or cancelled Ã¢â‚¬â€ SSE sets doneHandled but isRendering may linger
      if (doneHandled && !fillGapsActive) {
        // Already cleaned up by another path
        clearInterval(checkDone);
        return;
      }
    }, 1000);

  } catch (e) {
    showToast("Fill gaps error: " + e.message, "error");
    fillGapsActive = false;
    resetFillGapsBtn();
  }
}

function resetFillGapsBtn() {
  const btn = document.getElementById("btnFillGaps");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      Fill Gaps
    `;
  }
}


// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// HISTORY
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
async function loadHistory() {
  try {
    const res = await fetch("/api/history");
    if (!res.ok) return;
    const history = await res.json();
    renderHistory(history);
  } catch { /* silent */ }
}

function renderHistory(history) {
  const container = document.getElementById("historyList");

  if (!Array.isArray(history) || history.length === 0) {
    container.innerHTML = '<div class="loading-placeholder">No renders yet</div>';
    return;
  }

  container.innerHTML = history.slice(0, 10).map((h) => `
    <div class="history-item">
      <div class="hist-world">${escapeHtml(h.world || "Unknown")} \u2014 ${escapeHtml(h.dimension || "")}</div>
      <div class="hist-time">${formatDate(new Date(h.timestamp).toISOString())}</div>
      <div class="hist-stats">
        ${h.chunksRendered ? h.chunksRendered + " chunks" : ""}
        ${h.speed ? "\u00B7 " + h.speed + " c/s" : ""}
        \u00B7 ${formatMs(h.duration || 0)}
      </div>
    </div>
  `).join("");
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// UTILITIES
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
  setTimeout(() => map?.invalidateSize(), 250);
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("id-ID", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return String(iso); }
}

function formatMs(ms) {
  if (!ms || ms < 0) return "0s";
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// TOAST NOTIFICATIONS
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
function showToast(message, type = "info") {
  // Remove existing toasts
  document.querySelectorAll(".toast").forEach(t => t.remove());

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === "success" ? "\u2714" : type === "error" ? "\u2718" : "\u25B6"}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;
  document.body.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => toast.classList.add("show"));

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
// BDS CONSOLE
// Ã¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢ÂÃ¢â€¢Â
let bdsSSE = null;
let bdsPanelOpen = false;
let _sseBackoff = 3000; // SSE reconnect backoff (ms)

async function checkBdsStatus() {
  try {
    const res = await fetch("/api/bds/status");
    const data = await res.json();
    updateBdsUI(data.running);
  } catch {}
}

function toggleBdsPanel() {
  bdsPanelOpen = !bdsPanelOpen;
  document.getElementById("bdsBody").style.display = bdsPanelOpen ? "block" : "none";
  document.getElementById("bdsChevron").style.transform = bdsPanelOpen ? "rotate(180deg)" : "";
  if (bdsPanelOpen && !bdsSSE) connectBdsSSE();
}

function connectBdsSSE() {
  if (bdsSSE) { bdsSSE.close(); bdsSSE = null; }
  bdsSSE = new EventSource("/api/bds/logs");
  bdsSSE.onmessage = (e) => {
    try { appendBdsLog(JSON.parse(e.data)); } catch {}
  };

  // Listen for auto-render completion Ã¢â€ â€™ refresh tiles
  bdsSSE.addEventListener("render_done", (e) => {
    try {
      const data = JSON.parse(e.data);
      showToast(`Map updated: ${data.world}/${data.dimension}`, "success");
      // Auto-refresh tiles if viewing same world
      if (selectedWorld === data.world && currentDimension === data.dimension) {
        refreshTiles();
      }
    } catch {}
  });

  // Ã¢â€â‚¬Ã¢â€â‚¬ v12.3 Canvas-Based Pregen Visualization Ã¢â€â‚¬Ã¢â€â‚¬
  // All data stored in arrays, drawn on 1 canvas = ultra lightweight

  bdsSSE.addEventListener("pregen_progress", (e) => {
    try {
      const data = JSON.parse(e.data);
      const status = document.getElementById("pregenStatus");
      let eta = "";
      if (pregenStartTime && data.pct > 0 && data.pct < 100) {
        const elapsed = (Date.now() - pregenStartTime) / 1000;
        const remaining = (elapsed / data.pct) * (100 - data.pct);
        const m = Math.floor(remaining / 60);
        const s = Math.round(remaining % 60);
        eta = ` | ~${m}m ${s}s`;
      }
      // v13: flat grid, show simple progress (no ring label when ring=1/1)
      const phase = data.phase || "";
      const isFlat = phase === "RING 1/1";
      if (isFlat || !phase) {
        status.textContent = `${data.pct}% (${data.chunksDone || 0}/${data.totalChunks || "?"})${eta}`;
      } else {
        status.textContent = `${phase} | ${data.pct}% (${data.chunksDone}/${data.totalChunks})${eta}`;
      }
      status.style.color = "#22d3ee";
      status.className = "pregen-status active";
      // Canvas ring info (works for flat grid too: ring=1, total=1, pct=actual)
      pgCanvas.ring = 1;
      pgCanvas.totalRings = 1;
      pgCanvas.ringPct = data.pct / 100;
      pgCanvas.dirty = true;
    } catch {}
  });

  bdsSSE.addEventListener("pregen_chunk", (e) => {
    try {
      const d = JSON.parse(e.data);
      if (d.fail) {
        pgCanvas.failed.push(d.x, d.z);
        if (pgCanvas._failedKeys) pgCanvas._failedKeys.add(`${d.x},${d.z}`);
      } else {
        pgCanvas.completed.push(d.x, d.z);
        if (pgCanvas._completedKeys) pgCanvas._completedKeys.add(`${d.x},${d.z}`);
      }
      pgCanvas.dirty = true;
    } catch {}
  });

  bdsSSE.addEventListener("pregen_config", (e) => {
    try {
      const data = JSON.parse(e.data);
      pregenGridConfig = data;
      pgCanvas.reset();
      pgCanvas.config = data;
      pgCanvas.init();
      // Auto-show coverage overlay when pregen starts
      autoShowPregenCoverage();
    } catch {}
  });

  bdsSSE.addEventListener("pregen_zone", (e) => {
    try {
      const d = JSON.parse(e.data);
      const step = pregenGridConfig?.step || 256;
      pgCanvas.zones.push(d.zx * step, d.zz * step, (d.xe + 1) * step, (d.ze + 1) * step);
      pgCanvas.dirty = true;
    } catch {}
  });

  bdsSSE.addEventListener("pregen_sprint", (e) => {
    try {
      const d = JSON.parse(e.data);
      pgCanvas.bots[d.bot || 0] = { x: d.x, z: d.z, t: Date.now() };
      // Feed trail for animated path
      pgCanvas._trail.push({ x: d.x, z: d.z, t: Date.now() });
      if (pgCanvas._trail.length > 30) pgCanvas._trail.shift(); // keep last 30
      pgCanvas.dirty = true;
    } catch {}
  });

  bdsSSE.addEventListener("pregen_phase", () => {});

  bdsSSE.addEventListener("pregen_done", () => {
    const status = document.getElementById("pregenStatus");
    status.textContent = "Done!";
    status.className = "pregen-status done";
    status.style.color = "#22c55e";
    resetPregenUI();
    showToast("Pre-Gen selesai!", "success");
    // Auto-hide coverage overlay + panel after 30s
    setTimeout(() => {
      pgCanvas.destroy();
      hidePregenCoverage();
      pregenCoverageVisible = false;
      const panel = document.getElementById("pregenCovPanel");
      if (panel) panel.style.display = "none";
      status.textContent = "\u2014";
      status.className = "pregen-status";
    }, 30000);
  });

  bdsSSE.onerror = () => {
    bdsSSE.close(); bdsSSE = null;
    // Reconnect with backoff (3s Ã¢â€ â€™ 6s Ã¢â€ â€™ 12s Ã¢â€ â€™ max 30s)
    _sseBackoff = Math.min((_sseBackoff || 3000) * 2, 30000);
    setTimeout(() => connectBdsSSE(), _sseBackoff);
  };
  // Reset backoff on successful connection
  _sseBackoff = 3000;
}

function appendBdsLog(entry) {
  const container = document.getElementById("bdsLogs");
  const empty = container.querySelector(".bds-empty");
  if (empty) empty.remove();

  const div = document.createElement("div");
  div.className = "bds-log-line";
  if (entry.text.startsWith("> ")) div.classList.add("cmd");
  else if (entry.text.startsWith("[Dashboard]")) div.classList.add("system");
  else if (entry.text.includes("ERROR") || entry.text.startsWith("[STDERR]")) div.classList.add("error");

  const time = new Date(entry.time);
  const ts = document.createElement("span");
  ts.className = "log-time";
  ts.textContent = time.toLocaleTimeString("en-GB", { hour12: false });

  const tx = document.createElement("span");
  tx.textContent = entry.text;

  div.appendChild(ts);
  div.appendChild(tx);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  while (container.children.length > 500) container.removeChild(container.firstChild);
}

async function bdsStart() {
  try {
    const res = await fetch("/api/bds/start", { method: "POST" });
    const data = await res.json();
    if (data.status === "started" || data.status === "already_running") {
      updateBdsUI(true);
      if (!bdsSSE) connectBdsSSE();
      if (!bdsPanelOpen) toggleBdsPanel();
      showToast("BDS Server starting...", "success");
    } else if (data.error) {
      showToast("BDS Error: " + data.error, "error");
    }
  } catch { showToast("Failed to start BDS", "error"); }
}

async function bdsStop() {
  try {
    await fetch("/api/bds/stop", { method: "POST" });
    showToast("Server stopping...", "info");
    setTimeout(checkBdsStatus, 3000);
  } catch { showToast("Failed to stop BDS", "error"); }
}

async function bdsRestart() {
  try {
    const res = await fetch("/api/bds/status");
    const data = await res.json();
    if (data.running) {
      showToast("Restarting server...", "info");
      await fetch("/api/bds/stop", { method: "POST" });
      // Wait for stop, then start
      const waitForStop = setInterval(async () => {
        const check = await fetch("/api/bds/status");
        const st = await check.json();
        if (!st.running) {
          clearInterval(waitForStop);
          await fetch("/api/bds/start", { method: "POST" });
          updateBdsUI(true);
          if (!bdsSSE) connectBdsSSE();
        }
      }, 1000);
    } else {
      // Not running Ã¢â‚¬â€ just start
      bdsStart();
    }
  } catch { showToast("Failed to restart", "error"); }
}

async function bdsSendCommand() {
  const input = document.getElementById("bdsInput");
  const cmd = input.value.trim();
  if (!cmd) return;

  // Save to command history
  bdsCommandHistory.unshift(cmd);
  if (bdsCommandHistory.length > 50) bdsCommandHistory.pop();
  bdsHistoryIndex = -1;

  input.value = "";
  try {
    const res = await fetch("/api/bds/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: cmd }),
    });
    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || "Command failed", "error");
    }
  } catch { showToast("Failed to send command", "error"); }
}

function updateBdsUI(running) {
  document.getElementById("bdsDot").className = "bds-status-dot " + (running ? "online" : "offline");
  const text = document.getElementById("bdsStatusText");
  text.textContent = running ? "Online" : "Offline";
  text.style.color = running ? "var(--success)" : "";

  // Show server IP:Port when online
  const infoEl = document.getElementById("bdsServerInfo");
  if (infoEl) {
    if (running) {
      fetch("/api/server-info").then(r => r.json()).then(d => {
        infoEl.textContent = d.ip + ":" + d.port;
        infoEl.style.display = "inline";
      }).catch(() => {});
    } else {
      infoEl.style.display = "none";
    }
  }

  // Power buttons
  const btnStart = document.getElementById("btnBdsStart");
  const btnStop = document.getElementById("btnBdsStop");
  const btnRestart = document.getElementById("btnBdsRestart");

  btnStart.disabled = running;
  btnStop.disabled = !running;
  btnRestart.disabled = false;

  // Update document title with status
  const world = selectedWorld || "Dashboard";
  document.title = (world + " " + (running ? "[BDS ON]" : "") + " - Laughtale").trim();
}

// ===============================================================
// COMMAND HISTORY (Arrow Up/Down in BDS input)
// ===============================================================
let bdsCommandHistory = [];
let bdsHistoryIndex = -1;

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("bdsInput");
  if (!input) return;

  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (bdsHistoryIndex < bdsCommandHistory.length - 1) {
        bdsHistoryIndex++;
        input.value = bdsCommandHistory[bdsHistoryIndex];
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (bdsHistoryIndex > 0) {
        bdsHistoryIndex--;
        input.value = bdsCommandHistory[bdsHistoryIndex];
      } else {
        bdsHistoryIndex = -1;
        input.value = "";
      }
    }
  });
});

// ===============================================================
// KEYBOARD SHORTCUTS
// ===============================================================
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

  switch (e.key.toLowerCase()) {
    case "g": toggleChunkGrid(); break;
    case "s": goToSpawn(); break;
    case "f": if (!e.ctrlKey && !e.metaKey) toggleFullscreen(); break;
    case "/":
      e.preventDefault();
      if (!bdsPanelOpen) toggleBdsPanel();
      document.getElementById("bdsInput")?.focus();
      break;
    case "escape": if (bdsPanelOpen) toggleBdsPanel(); break;
    case "1": switchDimension("overworld"); break;
    case "2": switchDimension("nether"); break;
    case "3": switchDimension("end"); break;
  }
});

// ===============================================================
// AUTO MAP REGEN
// ===============================================================
let autoRegenCountdownTimer = null;

async function toggleAutoRegen() {
  const toggle = document.getElementById("autoregenToggle");
  const enabled = toggle.checked;
  const interval = parseInt(document.getElementById("autoregenInterval").value);

  if (enabled && !selectedWorld) {
    showToast("Pilih world dulu sebelum aktifkan Auto Regen", "error");
    toggle.checked = false;
    return;
  }

  try {
    const res = await fetch("/api/autoregen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, intervalMin: interval, world: selectedWorld, dimension: currentDimension }),
    });
    const data = await res.json();
    if (data.enabled) {
      showToast(`Auto Regen aktif - setiap ${data.intervalMin} menit`, "success");
      startCountdown(data.nextRegen);
    } else {
      showToast("Auto Regen dimatikan", "info");
      stopCountdown();
    }
  } catch { showToast("Gagal mengubah Auto Regen", "error"); }
}

async function updateAutoRegenInterval() {
  const toggle = document.getElementById("autoregenToggle");
  if (!toggle.checked) return;
  const interval = parseInt(document.getElementById("autoregenInterval").value);
  try {
    const res = await fetch("/api/autoregen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true, intervalMin: interval, world: selectedWorld, dimension: currentDimension }),
    });
    const data = await res.json();
    showToast(`Interval diubah ke ${data.intervalMin} menit`, "info");
    startCountdown(data.nextRegen);
  } catch {}
}

function startCountdown(nextRegenISO) {
  stopCountdown();
  const el = document.getElementById("autoregenCountdown");
  el.classList.add("active");

  autoRegenCountdownTimer = setInterval(() => {
    const now = Date.now();
    const next = new Date(nextRegenISO).getTime();
    const diff = next - now;

    if (diff <= 0) {
      el.textContent = "Rendering...";
      fetch("/api/autoregen").then(r => r.json()).then(d => {
        if (d.nextRegen && d.enabled) startCountdown(d.nextRegen);
      }).catch(() => {});
      return;
    }

    const min = Math.floor(diff / 60000);
    const sec = Math.floor((diff % 60000) / 1000);
    el.textContent = `${min}:${String(sec).padStart(2, "0")}`;
  }, 1000);
}

function stopCountdown() {
  if (autoRegenCountdownTimer) { clearInterval(autoRegenCountdownTimer); autoRegenCountdownTimer = null; }
  const el = document.getElementById("autoregenCountdown");
  if (el) { el.textContent = "\u2014"; el.classList.remove("active"); }
}

// ===============================================================
// PREGEN UI
// ===============================================================
let pregenStartTime = null;

async function startPregen() {
  const radius = parseInt(document.getElementById("pregenRadius").value) || 5000;
  const dimension = document.getElementById("pregenDimension").value || "overworld";
  try {
    const res = await fetch("/api/pregen/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ radius, dimension, botCount: 1 }),
    });
    const data = await res.json();
    if (data.error) { showToast(data.error, "error"); return; }
    pregenStartTime = Date.now();
    document.getElementById("btnPregen").style.display = "none";
    document.getElementById("btnPregenStop").style.display = "inline-flex";
    showToast(`PreGen started: ${data.radius * 2}x${data.radius * 2}`, "success");
    if (!bdsSSE) connectBdsSSE();
    if (!bdsPanelOpen) toggleBdsPanel();
  } catch { showToast("Failed to start PreGen", "error"); }
}

async function stopPregen() {
  try {
    await fetch("/api/pregen/stop", { method: "POST" });
    resetPregenUI();
    showToast("PreGen stopped", "info");
  } catch { showToast("Failed to stop PreGen", "error"); }
}

function resetPregenUI() {
  document.getElementById("btnPregen").style.display = "inline-flex";
  document.getElementById("btnPregenStop").style.display = "none";
  pregenStartTime = null;
}

// ===============================================================
// SYSTEM MONITOR
// ===============================================================
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
}

async function updateSystemStats() {
  try {
    const res = await fetch("/api/system/stats");
    const d = await res.json();

    document.getElementById("cpuPercent").textContent = d.cpu.percent + "%";
    document.getElementById("cpuBar").style.width = Math.min(d.cpu.percent, 100) + "%";
    document.getElementById("cpuModel").textContent = d.cpu.model + " (" + d.cpu.cores + " cores)";

    document.getElementById("ramPercent").textContent = d.memory.percent + "%";
    document.getElementById("ramBar").style.width = Math.min(d.memory.percent, 100) + "%";
    document.getElementById("ramDetail").textContent = formatBytes(d.memory.used) + " / " + formatBytes(d.memory.total);

    document.getElementById("procMem").textContent = formatBytes(d.process.rss);
    const upSec = d.process.uptime;
    const upMin = Math.floor(upSec / 60);
    const upHr = Math.floor(upMin / 60);
    document.getElementById("procUptime").textContent = "Uptime: " + (upHr > 0 ? upHr + "h " + (upMin % 60) + "m" : upMin + "m " + (upSec % 60) + "s");

    // Color coding
    const cpuBar = document.getElementById("cpuBar");
    cpuBar.style.background = d.cpu.percent > 80 ? "var(--danger)" : d.cpu.percent > 50 ? "var(--warning)" : "var(--accent)";
    const ramBar = document.getElementById("ramBar");
    ramBar.style.background = d.memory.percent > 85 ? "var(--danger)" : d.memory.percent > 65 ? "var(--warning)" : "var(--success)";
  } catch {}
}

setInterval(updateSystemStats, 3000);
updateSystemStats();

// ===============================================================
// PREGEN COVERAGE OVERLAY (Canvas-based)
// ===============================================================

// pgCanvas object - ultra-lightweight canvas renderer
const pgCanvas = {
  canvas: null, ctx: null, overlay: null,
  completed: [], failed: [], zones: [], bots: {},
  ring: 0, totalRings: 0, ringPct: 0,
  dirty: true, config: null,
  _trail: [],
  _completedKeys: null, _failedKeys: null,
  _rafId: null,

  reset() {
    this.completed = []; this.failed = []; this.zones = []; this.bots = {};
    this.ring = 0; this.totalRings = 0; this.ringPct = 0;
    this._trail = [];
    this._completedKeys = new Set();
    this._failedKeys = new Set();
    this.dirty = true;
  },

  init() {
    if (!this.config || !map) return;
    if (this.overlay) this.destroy();

    const CanvasOverlay = L.GridLayer.extend({
      createTile: (coords) => {
        const tile = document.createElement("canvas");
        tile.width = 256; tile.height = 256;
        return tile;
      }
    });
    this.overlay = new CanvasOverlay({ opacity: 0.6, pane: "overlayPane" });
    this.overlay.addTo(map);

    this._startRender();
  },

  _startRender() {
    if (this._rafId) return;
    const loop = () => {
      this._rafId = requestAnimationFrame(loop);
      if (!this.dirty) return;
      this.dirty = false;
    };
    this._rafId = requestAnimationFrame(loop);
  },

  destroy() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this.overlay) { map.removeLayer(this.overlay); this.overlay = null; }
  }
};

function autoShowPregenCoverage() {
  if (!pregenCoverageVisible) {
    pregenCoverageVisible = true;
    const panel = document.getElementById("pregenCovPanel");
    if (panel) panel.style.display = "block";
  }
}

function hidePregenCoverage() {
  pregenCoverageVisible = false;
  pgCanvas.destroy();
}

// ===============================================================
// INIT
// ===============================================================
loadWorlds();
loadHistory();
