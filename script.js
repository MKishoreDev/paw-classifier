/* ============================================================
   Paw Classifier — Vanilla JS
   Teachable Machine model + TensorFlow.js
   ============================================================ */

const MODEL_URL = "https://teachablemachine.withgoogle.com/models/5WRyMn4ya/";

// ---------- State ----------
const state = {
  model: null,
  maxPredictions: 0,
  history: [],
  webcamStream: null,
  webcamLoopId: null,
  currentDeviceId: null,
  devices: [],
};

// ---------- Demo images ----------
const DEMOS = [
  { name: "Tabby Cat", src: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&q=80" },
  { name: "Golden Dog", src: "https://images.unsplash.com/photo-1517849845537-4d257902454a?w=400&q=80" },
  { name: "Kitten", src: "https://images.unsplash.com/photo-1543852786-1cf6624b9987?w=400&q=80" },
  { name: "Puppy", src: "https://images.unsplash.com/photo-1552053831-71594a27632d?w=400&q=80" },
  { name: "Black Cat", src: "https://images.unsplash.com/photo-1548247416-ec66f4900b2e?w=400&q=80" },
  { name: "Husky", src: "https://images.unsplash.com/photo-1605568427561-40dd23c2acea?w=400&q=80" },
];

// ---------- DOM ----------
const $ = (id) => document.getElementById(id);

// ---------- Toast ----------
function toast(message, type = "info") {
  const wrap = $("toastWrap");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  const icons = { success: "check-circle-2", error: "alert-triangle", info: "info" };
  el.innerHTML = `<i data-lucide="${icons[type] || "info"}"></i><span>${message}</span>`;
  wrap.appendChild(el);
  if (window.lucide) window.lucide.createIcons();
  setTimeout(() => {
    el.classList.add("fade");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, 3200);
}

// ---------- Loader ----------
async function initLoader() {
  const fill = $("loader-fill");
  const pct = $("loader-percent");
  let progress = 0;
  const tick = setInterval(() => {
    progress = Math.min(progress + Math.random() * 8 + 4, 92);
    fill.style.width = progress + "%";
    pct.textContent = Math.floor(progress);
  }, 180);

  try {
    state.model = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
    state.maxPredictions = state.model.getTotalClasses();
    clearInterval(tick);
    fill.style.width = "100%";
    pct.textContent = "100";
    await sleep(500);
    $("loader").classList.add("hidden");
    toast("AI Model ready", "success");
  } catch (err) {
    clearInterval(tick);
    console.error(err);
    toast("Failed to load model. Check your network.", "error");
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Prediction pipeline ----------
async function runPrediction(imageEl, source = "upload") {
  if (!state.model) { toast("Model not loaded yet", "error"); return; }

  showUploadingUI();
  await sleep(300);
  showPreview(imageEl.src);
  showRunningUI();

  const t0 = performance.now();
  let predictions;
  try {
    predictions = await state.model.predict(imageEl);
  } catch (err) {
    console.error(err);
    toast("Prediction failed", "error");
    resetDropzoneUI();
    return;
  }
  const elapsed = Math.round(performance.now() - t0);

  resetDropzoneUI();
  renderResult(predictions, elapsed, source, imageEl.src);
  addHistory(predictions, source, imageEl.src);
}

function renderResult(predictions, elapsed, source, thumbSrc) {
  const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
  const top = sorted[0];
  const isCat = /cat/i.test(top.className);

  $("resultPlaceholder").hidden = true;
  $("result").hidden = false;

  $("resultLabel").textContent = top.className;
  $("resultConfidence").textContent = (top.probability * 100).toFixed(1) + "%";
  $("resultTime").textContent = elapsed + "ms";
  $("resultSource").textContent = source;

  const iconWrap = $("resultIcon");
  iconWrap.innerHTML = `<i data-lucide="${isCat ? "cat" : "dog"}"></i>`;

  const bars = $("bars");
  bars.innerHTML = "";
  sorted.forEach((p) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-top">
        <span class="bar-name">${escapeHTML(p.className)}</span>
        <span class="bar-val">${(p.probability * 100).toFixed(1)}%</span>
      </div>
      <div class="bar-track"><div class="bar-fill"></div></div>
    `;
    bars.appendChild(row);
    requestAnimationFrame(() => {
      row.querySelector(".bar-fill").style.width = (p.probability * 100) + "%";
    });
  });

  if (window.lucide) window.lucide.createIcons();
}

// ---------- History ----------
function addHistory(predictions, source, thumbSrc) {
  const sorted = [...predictions].sort((a, b) => b.probability - a.probability);
  const top = sorted[0];
  state.history.unshift({
    label: top.className,
    confidence: top.probability,
    source,
    thumb: thumbSrc,
    time: new Date(),
  });
  state.history = state.history.slice(0, 5);
  renderHistory();
}

function renderHistory() {
  const list = $("historyList");
  if (!state.history.length) {
    list.innerHTML = `<div class="history-empty">No predictions yet. Try an image to get started.</div>`;
    return;
  }
  list.innerHTML = "";
  state.history.forEach((h) => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.innerHTML = `
      <img src="${h.thumb}" alt="" loading="lazy" />
      <div class="history-info">
        <div class="h-label">${escapeHTML(h.label)}</div>
        <div class="h-meta">${h.source} · ${formatTime(h.time)}</div>
      </div>
      <div class="h-conf">${(h.confidence * 100).toFixed(1)}%</div>
    `;
    list.appendChild(item);
  });
}

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ---------- UI helpers ----------
function showPreview(src) {
  $("previewEmpty").hidden = true;
  const img = $("previewImg");
  img.src = src;
  img.hidden = false;
}

function showUploadingUI() {
  $("dzInner").hidden = true;
  $("dzProgress").hidden = false;
  $("dzStatus").textContent = "Uploading...";
  animateBar($("dzBar"), 0, 60, 400);
}
function showRunningUI() {
  $("dzStatus").textContent = "Running AI Model...";
  animateBar($("dzBar"), 60, 100, 500);
}
function resetDropzoneUI() {
  setTimeout(() => {
    $("dzProgress").hidden = true;
    $("dzInner").hidden = false;
    $("dzBar").style.width = "0%";
  }, 400);
}
function animateBar(el, from, to, dur) {
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / dur, 1);
    el.style.width = (from + (to - from) * t) + "%";
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---------- Image loading ----------
function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Not an image"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImageFromURL(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// ---------- Dropzone ----------
function initDropzone() {
  const dz = $("dropzone");
  const input = $("fileInput");

  dz.addEventListener("click", () => input.click());
  dz.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
  });

  input.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFile(file);
    input.value = "";
  });

  ["dragenter", "dragover"].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("drag"); })
  );
  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove("drag"); })
  );
  dz.addEventListener("drop", async (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file) await handleFile(file);
  });

  window.addEventListener("paste", async (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
    if (item) {
      const file = item.getAsFile();
      if (file) await handleFile(file);
    }
  });
}

async function handleFile(file) {
  try {
    const img = await loadImageFromFile(file);
    await runPrediction(img, "upload");
  } catch (err) {
    console.error(err);
    toast("Could not load that image", "error");
  }
}

// ---------- Demo ----------
function initDemos() {
  const grid = $("demoGrid");
  DEMOS.forEach((d) => {
    const card = document.createElement("button");
    card.className = "demo-card";
    card.setAttribute("aria-label", `Try demo: ${d.name}`);
    card.innerHTML = `
      <img src="${d.src}" alt="${d.name}" loading="lazy" />
      <span class="label">${d.name}</span>
    `;
    card.addEventListener("click", async () => {
      try {
        const img = await loadImageFromURL(d.src);
        await runPrediction(img, "demo");
      } catch (err) {
        console.error(err);
        toast("Could not load demo image", "error");
      }
    });
    grid.appendChild(card);
  });
}

// ---------- Camera ----------
async function listCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    state.devices = devices.filter((d) => d.kind === "videoinput");
    const sel = $("camSelect");
    sel.innerHTML = "";
    state.devices.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Camera ${i + 1}`;
      sel.appendChild(opt);
    });
    const saved = localStorage.getItem("pawCameraId");
    if (saved && state.devices.some((d) => d.deviceId === saved)) {
      sel.value = saved;
      state.currentDeviceId = saved;
    } else if (state.devices[0]) {
      state.currentDeviceId = state.devices[0].deviceId;
    }
    $("camSwitch").disabled = state.devices.length < 2;
  } catch (err) { console.error(err); }
}

async function startCamera() {
  const status = $("camStatus");
  status.hidden = false;
  status.textContent = "Connecting...";

  try {
    stopCameraStream();
    const constraints = state.currentDeviceId
      ? { video: { deviceId: { exact: state.currentDeviceId } } }
      : { video: { facingMode: "user" } };
    state.webcamStream = await navigator.mediaDevices.getUserMedia(constraints);

    const video = $("video");
    video.srcObject = state.webcamStream;
    await video.play();
    video.hidden = false;
    $("camPlaceholder").hidden = true;

    await listCameras(); // refresh with labels after permission
    if (state.currentDeviceId) localStorage.setItem("pawCameraId", state.currentDeviceId);

    status.textContent = "Ready";
    setTimeout(() => (status.hidden = true), 1200);

    $("camStart").disabled = true;
    $("camStop").disabled = false;

    startCameraLoop();
  } catch (err) {
    console.error(err);
    status.hidden = true;
    toast("Camera access denied or unavailable", "error");
  }
}

function stopCameraStream() {
  if (state.webcamStream) {
    state.webcamStream.getTracks().forEach((t) => t.stop());
    state.webcamStream = null;
  }
  if (state.webcamLoopId) {
    cancelAnimationFrame(state.webcamLoopId);
    state.webcamLoopId = null;
  }
}

function stopCamera() {
  stopCameraStream();
  const video = $("video");
  video.hidden = true;
  video.srcObject = null;
  $("camPlaceholder").hidden = false;
  $("camStart").disabled = false;
  $("camStop").disabled = true;
}

let lastCamPredict = 0;
function startCameraLoop() {
  const video = $("video");
  const canvas = $("camCanvas");
  canvas.width = 224; canvas.height = 224;
  const ctx = canvas.getContext("2d");

  const loop = async (t) => {
    if (!state.webcamStream) return;
    if (t - lastCamPredict > 700 && video.readyState >= 2) {
      lastCamPredict = t;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        const preds = await state.model.predict(canvas);
        // Update the result panel live
        renderResult(preds, 0, "camera", canvas.toDataURL("image/jpeg", 0.6));
        $("previewEmpty").hidden = true;
        const img = $("previewImg");
        img.src = canvas.toDataURL("image/jpeg", 0.6);
        img.hidden = false;
      } catch (e) { /* ignore transient errors */ }
    }
    state.webcamLoopId = requestAnimationFrame(loop);
  };
  state.webcamLoopId = requestAnimationFrame(loop);
}

function initCamera() {
  $("camStart").addEventListener("click", startCamera);
  $("camStop").addEventListener("click", () => {
    stopCamera();
    // capture one last frame into history
    const canvas = $("camCanvas");
    if (canvas.width) {
      addHistoryFromCanvas(canvas);
    }
  });
  $("camSelect").addEventListener("change", (e) => {
    state.currentDeviceId = e.target.value;
    localStorage.setItem("pawCameraId", state.currentDeviceId);
    if (state.webcamStream) startCamera();
  });
  $("camSwitch").addEventListener("click", () => {
    const sel = $("camSelect");
    const idx = state.devices.findIndex((d) => d.deviceId === sel.value);
    const next = state.devices[(idx + 1) % state.devices.length];
    if (next) {
      sel.value = next.deviceId;
      sel.dispatchEvent(new Event("change"));
    }
  });

  if (navigator.mediaDevices?.enumerateDevices) listCameras();
}

async function addHistoryFromCanvas(canvas) {
  try {
    const preds = await state.model.predict(canvas);
    addHistory(preds, "camera", canvas.toDataURL("image/jpeg", 0.6));
  } catch {}
}

// ---------- Utils ----------
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

// ---------- Nav ----------
function initNav() {
  const links = document.querySelector(".nav-links");
  $("navToggle").addEventListener("click", () => links.classList.toggle("open"));
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => links.classList.remove("open"))
  );
}

// ---------- Boot ----------
window.addEventListener("DOMContentLoaded", () => {
  if (window.lucide) window.lucide.createIcons();
  initNav();
  initDropzone();
  initDemos();
  initCamera();
  initLoader();
});
