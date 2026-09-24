/* ═══════════════════════════════════════════════════════════════
   OBS Deck — Deck Page Logic
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ── State ─────────────────────────────────────────────────── */
  let pages = {};
  let pageOrder = [];
  let buttons = {};
  let status = {};
  let currentPageIdx = 0;
  let isFS = false;
  let unlocked = false;
  const stepState = {}; // "pageId:key" -> current step index (Companion advance/latch)
  const tileCooldown = {}; // panic-click guard: one fire per tile per 500ms
  const TILE_COOLDOWN_MS = 500;
  let btnRef = null; // per-page buttons subscription (avoids whole-tree downloads)
  let btnPage = null;

  /* ── Settings (persisted as URL query params) ──────────────── */
  let cfgPages = [];
  let cfgMinCol = 99;
  let cfgMaxCol = 99;
  let cfgMinRow = 99;
  let cfgMaxRow = 99;
  let cfgCols = 0;
  let cfgHideConfig = false;
  let cfgHideFS = false;
  let cfgShowHeadings = true;

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  /* ── Helpers ───────────────────────────────────────────────── */
  function norm(s) {
    return String(s || "").trim().toLowerCase();
  }

  function normalizeButton(btn, key) {
    if (!btn) return btn;
    // Phase A: migrate old {actions,feedbacks} → {steps:[{actions,feedbacks}]}
    if (typeof OBS_DEFS !== "undefined" && OBS_DEFS.migrateButton) {
      const m = OBS_DEFS.migrateButton(btn, key);
      m.actions = OBS_DEFS.flatActions(m);
      m.feedbacks = OBS_DEFS.flatFeedbacks(m);
      return m;
    }
    const out = { ...btn, id: btn.id || key };
    if (!out.actions || !Array.isArray(out.actions)) out.actions = [];
    if (!out.feedbacks || !Array.isArray(out.feedbacks)) out.feedbacks = [];
    if (!out.style) out.style = {};
    if (!out.icon) out.icon = "";
    if (!out.label) out.label = "";
    return out;
  }

  /* ── URL Query Params ──────────────────────────────────────── */
  function loadParams() {
    const p = new URLSearchParams(window.location.search);
    if (p.has("pages")) cfgPages = p.get("pages").split(",").map(Number).filter((n) => !isNaN(n));
    if (p.has("minCol")) cfgMinCol = parseInt(p.get("minCol")) || 99;
    if (p.has("maxCol")) cfgMaxCol = parseInt(p.get("maxCol")) || 99;
    if (p.has("minRow")) cfgMinRow = parseInt(p.get("minRow")) || 99;
    if (p.has("maxRow")) cfgMaxRow = parseInt(p.get("maxRow")) || 99;
    if (p.has("cols")) cfgCols = parseInt(p.get("cols")) || 0;
    if (p.has("hideConfig")) cfgHideConfig = p.get("hideConfig") === "true";
    if (p.has("hideFullscreen")) cfgHideFS = p.get("hideFullscreen") === "true";
    if (p.has("showHeadings")) cfgShowHeadings = p.get("showHeadings") !== "false";
  }

  function saveParams() {
    const p = new URLSearchParams();
    if (cfgPages.length) p.set("pages", cfgPages.join(","));
    if (cfgMinCol !== 99) p.set("minCol", cfgMinCol);
    if (cfgMaxCol !== 99) p.set("maxCol", cfgMaxCol);
    if (cfgMinRow !== 99) p.set("minRow", cfgMinRow);
    if (cfgMaxRow !== 99) p.set("maxRow", cfgMaxRow);
    if (cfgCols !== 0) p.set("cols", cfgCols);
    if (cfgHideConfig) p.set("hideConfig", "true");
    if (cfgHideFS) p.set("hideFullscreen", "true");
    if (!cfgShowHeadings) p.set("showHeadings", "false");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? "?" + qs : window.location.pathname);
  }

  /* ── PIN (removed on deck — open access; admin page still PIN-protected) ── */
  function initPin() {
    unlocked = true;
    const overlay = $("#pin-overlay");
    if (overlay) overlay.classList.add("dk-hidden");
    initApp();
  }

  /* ── Init App ──────────────────────────────────────────────── */
  function initApp() {
    const screen = $("#app-screen");
    screen.classList.remove("dk-hidden");
    screen.classList.add("active");

    loadParams();
    applyCfgToUI();
    initFirebase();
    initFullscreen();
    initConfigure();
    initPageNav();
  }

  /* ── Apply config to UI ────────────────────────────────────── */
  function applyCfgToUI() {
    const fsBtn = $("#dk-btn-fs");
    const cfgBtn = $("#dk-btn-cfg");
    if (cfgHideFS && fsBtn) fsBtn.style.display = "none";
    if (cfgHideConfig && cfgBtn) cfgBtn.style.display = "none";

    const headings = $("#dk-headings");
    if (headings) headings.style.display = cfgShowHeadings ? "flex" : "none";

    if (isFS) {
      document.body.classList.add("dk-isfs");
    } else {
      document.body.classList.remove("dk-isfs");
    }
  }

  /* ── Firebase ──────────────────────────────────────────────── */
  function initFirebase() {
    if (!fbDb) {
      console.error("Firebase not initialized");
      return;
    }

    // Flat listeners: pages (tiny) + status (live feedbacks). Buttons are
    // subscribed per visible page only, so the deck never downloads the
    // whole multi-page tree on every small edit.
    fbDb.ref("pages").on("value", (snap) => {
      pages = snap.val() || {};
      buildPageOrder();
      subscribeButtons();
      renderPageNav();
    });

    let lastSeenErrTs = 0;
    let errTimer = null;

    fbDb.ref("status").on("value", (snap) => {
      status = snap.val() || {};
      updateHighlights();
      // Toast bridge errors (e.g. renamed/deleted source) so the director sees them
      const le = status.lastError || {};
      if (le.ts && le.ts !== lastSeenErrTs && le.message) {
        lastSeenErrTs = le.ts;
        let toast = document.getElementById("dk-err-toast");
        if (!toast) {
          toast = document.createElement("div");
          toast.id = "dk-err-toast";
          toast.className = "dk-err-toast";
          document.body.appendChild(toast);
        }
        toast.textContent = "⚠ " + le.message;
        toast.style.display = "block";
        if (errTimer) clearTimeout(errTimer);
        errTimer = setTimeout(() => { toast.style.display = "none"; }, 5000);
      }
    });
  }

  function subscribeButtons() {
    if (typeof fbDb === "undefined" || !fbDb) return;
    const pid = getCurrentPageId();
    if (pid === btnPage) return;
    if (btnRef) { try { btnRef.off(); } catch (e) {} }
    btnPage = pid;
    buttons = {};
    if (!pid) { renderGrid(); return; }
    btnRef = fbDb.ref("buttons/" + pid);
    btnRef.on("value", (snap) => {
      buttons[pid] = snap.val() || {};
      renderGrid();
    });
  }

  /* ── Page Order ────────────────────────────────────────────── */
  function buildPageOrder() {
    pageOrder = Object.keys(pages).sort((a, b) => {
      const oa = pages[a].order ?? 0;
      const ob = pages[b].order ?? 0;
      return oa - ob;
    });

    if (cfgPages.length) {
      pageOrder = pageOrder.filter((_, i) => cfgPages.includes(i));
    }

    if (currentPageIdx >= pageOrder.length) {
      currentPageIdx = 0;
    }
  }

  function getCurrentPageId() {
    return pageOrder[currentPageIdx] || null;
  }

  /* ── Grid Rendering ────────────────────────────────────────── */
  function renderGrid() {
    const grid = $("#dk-grid");
    if (!grid) return;
    grid.innerHTML = "";

    const pageId = getCurrentPageId();
    if (!pageId) return;

    const pageBtns = buttons[pageId] || {};
    const keys = Object.keys(pageBtns);
    if (!keys.length) return;

    let maxRow = 0, maxCol = 0;
    keys.forEach((k) => {
      const [r, c] = k.split("_").map(Number);
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;
    });

    let numCols = maxCol + 1;
    let numRows = maxRow + 1;

    if (cfgMinCol !== 99 && numCols < cfgMinCol) numCols = cfgMinCol;
    if (cfgMaxCol !== 99 && numCols > cfgMaxCol) numCols = cfgMaxCol;
    if (cfgMinRow !== 99 && numRows < cfgMinRow) numRows = cfgMinRow;
    if (cfgMaxRow !== 99 && numRows > cfgMaxRow) numRows = cfgMaxRow;
    if (cfgCols > 0) numCols = cfgCols;

    grid.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${numRows}, 1fr)`;

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const key = `${r}_${c}`;
        const btnCfg = pageBtns[key];
        const div = document.createElement("div");
        div.className = "dk-tile";

        if (btnCfg) {
          const nb = normalizeButton(btnCfg, key);
          const bg = nb.style?.bg || "#2a2a2a";
          const color = nb.style?.color || "#fff";
          div.style.background = bg;
          div.style.color = color;
          div.style.fontWeight = nb.style?.fontWeight || "normal";
          div.style.border = "1px solid " + (nb.style?.border || "#222");
          div.style.fontSize = (nb.style?.fontSize || 14) + "px";

          if (nb.icon) {
            const iconSpan = document.createElement("span");
            iconSpan.className = "dk-icon";
            iconSpan.textContent = nb.icon;
            div.appendChild(iconSpan);
          }
          if (nb.label) {
            const lbl = document.createElement("span");
            lbl.className = "dk-label";
            lbl.textContent = nb.label;
            div.appendChild(lbl);
          }
          // Show step dots when multi-step (Companion-style)
          const _m = (typeof OBS_DEFS !== "undefined" && OBS_DEFS.migrateButton) ? OBS_DEFS.migrateButton(btnCfg, key) : null;
          if (_m && _m.steps && _m.steps.length > 1) {
            const dots = document.createElement("span");
            dots.className = "dk-steps";
            dots.textContent = "●".repeat(_m.steps.length);
            div.appendChild(dots);
          }

          const pageId = getCurrentPageId();
          div.addEventListener("click", () => {
            // Debounce: ignore lag-induced double/triple clicks on the same tile
            const now = Date.now();
            const ck = pageId + ":" + key;
            if (now - (tileCooldown[ck] || 0) < TILE_COOLDOWN_MS) return;
            tileCooldown[ck] = now;
            div.style.opacity = "0.6";
            setTimeout(() => { div.style.opacity = ""; }, TILE_COOLDOWN_MS);
            fireActions(nb, ck);
          });
        } else {
          div.classList.add("empty-tile");
          div.style.background = "#1a1a1a";
        }

        div.dataset.key = key;
        grid.appendChild(div);
      }
    }

    updateHighlights();
    if (isFS) calcFit();
  }

  /* ── Fire Actions (steps-aware) ────────────────────────────── */
  function fireActions(btnCfg, stepKey) {
    const m = (typeof OBS_DEFS !== "undefined" && OBS_DEFS.migrateButton) ? OBS_DEFS.migrateButton(btnCfg, stepKey) : btnCfg;
    const steps = (m && m.steps && m.steps.length) ? m.steps : [{ actions: (btnCfg.actions || []) }];
    const mode = (m && m.stepMode) || btnCfg.stepMode || "advance";
    const skey = stepKey || ("k:" + (btnCfg.id || Math.random()));
    let idx = stepState[skey] || 0;
    if (idx >= steps.length) idx = 0;
    const actions = (steps[idx] && steps[idx].actions) || [];
    // Advance for next press (latch stays on last step)
    if (steps.length > 1) {
      if (mode === "latch") stepState[skey] = Math.min(idx + 1, steps.length - 1);
      else stepState[skey] = (idx + 1) % steps.length;
    }
    if (!actions.length) return;
    const queued = [];

    actions.forEach((act) => {
      // General solution: ONE table (OBS_DEFS.buildCommand) turns every
      // button action into its wire command. Direct OBS requests become
      // custom_command passthrough; LOGIC:* actions keep their legacy key
      // for the bridge's logic handlers. No per-type code here.
      const built = (typeof OBS_DEFS !== "undefined" && OBS_DEFS.buildCommand)
        ? OBS_DEFS.buildCommand(act)
        : { key: act.type, value: act.params || {} };
      const delayMs = parseInt(act.delayMs) || 0;
      if (delayMs > 0 || actions.length > 1) {
        queued.push({ key: built.key, value: built.value, delayMs: delayMs });
      } else {
        fbDb.ref("commands").child(built.key).set(built.value);
      }
    });
    if (queued.length) {
      fbDb.ref("commands/queue").set(queued);
    }
  }

  /* ── Feedback Highlights ───────────────────────────────────── */
  const FEEDBACK_COLORS = {
    green: { bg: "#1e6f5c", color: "#fff" },
    red: { bg: "#c23b22", color: "#fff" },
    blue: { bg: "#2b4c7e", color: "#fff" },
    yellow: { bg: "#b7791f", color: "#fff" },
    orange: { bg: "#d97706", color: "#fff" },
    purple: { bg: "#6b21a8", color: "#fff" },
    cyan: { bg: "#0891b2", color: "#fff" },
    white: { bg: "#e0e0e0", color: "#111" },
  };

  function updateHighlights() {
    const grid = $("#dk-grid");
    if (!grid) return;
    const pageId = getCurrentPageId();
    if (!pageId) return;
    const pageBtns = buttons[pageId] || {};

    grid.querySelectorAll(".dk-tile").forEach((div) => {
      const key = div.dataset.key;
      const btnCfg = pageBtns[key];
      if (!btnCfg) return;

      const nb = normalizeButton(btnCfg, key);
      const baseBg = nb.style?.bg || "#2a2a2a";
      const baseColor = nb.style?.color || "#fff";

      div.style.background = baseBg;
      div.style.color = baseColor;
      div.style.fontWeight = nb.style?.fontWeight || "normal";
      div.style.border = "1px solid " + (nb.style?.border || "#222");

      const feedbacks = nb.feedbacks || [];
      feedbacks.forEach((fb) => {
        const fbType = fb.type;
        const params = fb.params || {};
        const activeColor = fb.activeColor || "green";
        const colors = FEEDBACK_COLORS[activeColor] || { bg: "#1e6f5c", color: "#fff" };
        let matched = false;

        if (fbType === "scene_in_program") {
          const btnScene = norm(params.scene || nb.params?.scene);
          const curScene = norm(status.programScene || status.scene);
          if (btnScene && curScene && btnScene === curScene) matched = true;
        } else if (fbType === "scene_in_preview") {
          const btnScene = norm(params.scene || nb.params?.scene);
          const curPreview = norm(status.previewScene || status.preview);
          if (btnScene && curPreview && btnScene === curPreview) matched = true;
        } else if (fbType === "streaming_active") {
          if (status.streaming) matched = true;
        } else if (fbType === "recording_active") {
          if (status.recording) matched = true;
        } else if (fbType === "recording_paused") {
          if (status.recording && status.paused) matched = true;
        } else if (fbType === "replay_buffer_active") {
          if (status.replayBuffer) matched = true;
        } else if (fbType === "source_visible") {
          const src = params.source;
          if (src && status.sources && status.sources[src]) {
            if (status.sources[src].visible) matched = true;
          }
        } else if (fbType === "source_muted") {
          const src = params.source;
          if (src && status.sources && status.sources[src]) {
            if (status.sources[src].muted) matched = true;
          }
        } else if (fbType === "output_active") {
          if (params.output && status.outputs && status.outputs[params.output]) {
            if (status.outputs[params.output].active) matched = true;
          }
        } else if (fbType === "transition_active") {
          if (status.transitioning) matched = true;
        } else if (fbType === "studio_mode_active") {
          if (status.studioMode) matched = true;
        } else if (fbType === "filter_enabled") {
          if (params.source && status.filters && status.filters[params.source]) {
            const v = status.filters[params.source][params.filter];
            if (v) matched = true;
          }
        } else if (fbType === "volume_exact") {
          if (params.source && status.volumes) {
            const cur = parseFloat(status.volumes[params.source]);
            if (!isNaN(cur) && Math.abs(cur - parseFloat(params.volume || 0)) < 0.6) matched = true;
          }
        } else if (fbType === "media_playing") {
          if (params.source && status.media && status.media[params.source]) {
            const st = String(status.media[params.source].state || "").toLowerCase();
            if (st.includes("play")) matched = true;
          }
        } else if (fbType === "profile_active") {
          if (params.name && norm(params.name) === norm(status.currentProfile)) matched = true;
        } else if (fbType === "collection_active") {
          if (params.name && norm(params.name) === norm(status.currentCollection)) matched = true;
        }

        if (matched) {
          div.style.background = colors.bg;
          div.style.color = colors.color;
        }
      });
    });
  }

  /* ── Page Navigation ───────────────────────────────────────── */
  function initPageNav() {
    const prev = $(".dk-page-nav");
    if (!prev) return;

    prev.addEventListener("click", (e) => {
      const dot = e.target.closest(".dk-page-dot");
      if (!dot) return;
      const idx = parseInt(dot.dataset.idx);
      if (!isNaN(idx)) {
        currentPageIdx = idx;
        subscribeButtons();
        renderPageNav();
      }
    });
  }

  function renderPageNav() {
    const nav = $("#dk-page-nav");
    if (!nav) return;
    nav.innerHTML = "";

    if (pageOrder.length <= 1) {
      nav.style.display = "none";
      return;
    }
    nav.style.display = "flex";

    pageOrder.forEach((pid, i) => {
      const dot = document.createElement("button");
      dot.className = "dk-page-dot" + (i === currentPageIdx ? " active" : "");
      dot.dataset.idx = i;
      dot.title = pages[pid]?.name || `Page ${i + 1}`;
      nav.appendChild(dot);
    });
  }

  /* ── Fullscreen ────────────────────────────────────────────── */
  function initFullscreen() {
    const fsBtn = $("#dk-btn-fs");
    if (fsBtn) {
      fsBtn.addEventListener("click", toggleFullscreen);
    }
    document.addEventListener("fullscreenchange", () => {
      isFS = !!document.fullscreenElement;
      applyCfgToUI();
      if (isFS) calcFit();
    });
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }

  function calcFit() {
    const grid = $("#dk-grid");
    if (!grid) return;

    const pageId = getCurrentPageId();
    if (!pageId) return;
    const pageBtns = buttons[pageId] || {};
    const keys = Object.keys(pageBtns);
    if (!keys.length) return;

    let maxRow = 0, maxCol = 0;
    keys.forEach((k) => {
      const [r, c] = k.split("_").map(Number);
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;
    });

    let numCols = maxCol + 1;
    let numRows = maxRow + 1;

    if (cfgMinCol !== 99 && numCols < cfgMinCol) numCols = cfgMinCol;
    if (cfgMaxCol !== 99 && numCols > cfgMaxCol) numCols = cfgMaxCol;
    if (cfgMinRow !== 99 && numRows < cfgMinRow) numRows = cfgMinRow;
    if (cfgMaxRow !== 99 && numRows > cfgMaxRow) numRows = cfgMaxRow;
    if (cfgCols > 0) numCols = cfgCols;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tileW = Math.floor(vw / numCols);
    const tileH = Math.floor(vh / numRows);
    const tileSize = Math.max(Math.min(tileW, tileH), 60);

    grid.style.gridTemplateColumns = `repeat(${numCols}, ${tileSize}px)`;
    grid.style.gridTemplateRows = `repeat(${numRows}, ${tileSize}px)`;
    grid.style.justifyContent = "center";
    grid.style.alignContent = "center";
  }

  /* ── Configure Dialog ──────────────────────────────────────── */
  function initConfigure() {
    const overlay = $("#dk-cfg-overlay");
    const cfgBtn = $("#dk-btn-cfg");
    const closeBtn = $("#dk-cfg-close");
    const applyBtn = $("#dk-cfg-apply");

    if (cfgBtn) {
      cfgBtn.addEventListener("click", () => {
        openCfgDialog();
        overlay.classList.remove("dk-hidden");
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => overlay.classList.add("dk-hidden"));
    }

    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        readCfgDialog();
        saveParams();
        applyCfgToUI();
        buildPageOrder();
        subscribeButtons();
        renderPageNav();
        overlay.classList.add("dk-hidden");
      });
    }

    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) overlay.classList.add("dk-hidden");
      });
    }
  }

  function openCfgDialog() {
    const total = pageOrder.length;
    const allPages = Object.keys(pages).sort((a, b) => (pages[a].order ?? 0) - (pages[b].order ?? 0));
    const indices = allPages.map((_, i) => i);

    $("#cfg-pages").value = cfgPages.length ? cfgPages.join(",") : "";
    $("#cfg-mincol").value = cfgMinCol === 99 ? "" : cfgMinCol;
    $("#cfg-maxcol").value = cfgMaxCol === 99 ? "" : cfgMaxCol;
    $("#cfg-minrow").value = cfgMinRow === 99 ? "" : cfgMinRow;
    $("#cfg-maxrow").value = cfgMaxRow === 99 ? "" : cfgMaxRow;
    $("#cfg-cols").value = cfgCols || "";
    $("#cfg-hideconfig").checked = cfgHideConfig;
    $("#cfg-hidefs").checked = cfgHideFS;
    $("#cfg-showheadings").checked = cfgShowHeadings;
  }

  function readCfgDialog() {
    const pagesStr = $("#cfg-pages").value.trim();
    cfgPages = pagesStr ? pagesStr.split(",").map(Number).filter((n) => !isNaN(n)) : [];
    cfgMinCol = parseInt($("#cfg-mincol").value) || 99;
    cfgMaxCol = parseInt($("#cfg-maxcol").value) || 99;
    cfgMinRow = parseInt($("#cfg-minrow").value) || 99;
    cfgMaxRow = parseInt($("#cfg-maxrow").value) || 99;
    cfgCols = parseInt($("#cfg-cols").value) || 0;
    cfgHideConfig = $("#cfg-hideconfig").checked;
    cfgHideFS = $("#cfg-hidefs").checked;
    cfgShowHeadings = $("#cfg-showheadings").checked;
  }

  /* ── Boot ──────────────────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", initPin);
})();
