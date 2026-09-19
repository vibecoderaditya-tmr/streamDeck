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
    const out = { ...btn, id: btn.id || key };

    if (!out.actions || !Array.isArray(out.actions)) {
      out.actions = [];
      if (btn.action) {
        const act = { type: btn.action, params: {} };
        if (btn.scene) act.params.scene = btn.scene;
        else if (btn.value) act.params.scene = btn.value;
        if (btn.source) act.params.source = btn.source;
        if (btn.scene && btn.itemId !== undefined) {
          act.params.scene = btn.scene;
          act.params.itemId = btn.itemId;
        }
        out.actions.push(act);
      }
    }

    if (!out.feedbacks || !Array.isArray(out.feedbacks)) {
      out.feedbacks = [];
      if (btn.feedback) {
        const fb = { type: btn.feedback.type || btn.feedback, params: {}, activeColor: btn.feedback.activeColor || "green" };
        if (btn.feedback.scene) fb.params.scene = btn.feedback.scene;
        else if (btn.scene) fb.params.scene = btn.scene;
        else if (btn.value) fb.params.scene = btn.value;
        if (btn.feedback.rules && Array.isArray(btn.feedback.rules)) {
          btn.feedback.rules.forEach((r) => {
            const fbr = { type: r.type || r.feedback, params: {}, activeColor: r.activeColor || "green" };
            if (r.scene) fbr.params.scene = r.scene;
            else if (r.value) fbr.params.scene = r.value;
            out.feedbacks.push(fbr);
          });
        } else {
          out.feedbacks.push(fb);
        }
      }
    }

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

    fbDb.ref("pages").on("value", (snap) => {
      pages = snap.val() || {};
      buildPageOrder();
      renderGrid();
      renderPageNav();
    });

    fbDb.ref("buttons").on("value", (snap) => {
      buttons = snap.val() || {};
      renderGrid();
    });

    fbDb.ref("status").on("value", (snap) => {
      status = snap.val() || {};
      updateHighlights();
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

          div.addEventListener("click", () => fireActions(nb));
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

  /* ── Fire Actions ──────────────────────────────────────────── */
  function fireActions(btnCfg) {
    const actions = btnCfg.actions || [];
    if (!actions.length) return;

    actions.forEach((act) => {
      const cmd = {};
      const type = act.type;
      const params = act.params || {};

      if (type === "set_program_scene") {
        cmd.set_program_scene = params.scene || "";
      } else if (type === "set_preview_scene") {
        cmd.set_preview_scene = params.scene || "";
      } else if (type === "smart_scene_switch") {
        cmd.smart_scene_switch = params.scene || "";
      } else if (type === "trigger_transition") {
        cmd.trigger_transition = true;
      } else if (type === "toggle_streaming") {
        cmd.toggle_streaming = true;
      } else if (type === "toggle_recording") {
        cmd.toggle_recording = true;
      } else if (type === "start_streaming") {
        cmd.start_streaming = true;
      } else if (type === "stop_streaming") {
        cmd.stop_streaming = true;
      } else if (type === "start_recording") {
        cmd.start_recording = true;
      } else if (type === "stop_recording") {
        cmd.stop_recording = true;
      } else if (type === "pause_recording") {
        cmd.pause_recording = true;
      } else if (type === "unpause_recording") {
        cmd.unpause_recording = true;
      } else if (type === "toggle_pause_recording") {
        cmd.toggle_pause_recording = true;
      } else if (type === "split_recording") {
        cmd.split_recording = true;
      } else if (type === "start_replay_buffer") {
        cmd.start_replay_buffer = true;
      } else if (type === "stop_replay_buffer") {
        cmd.stop_replay_buffer = true;
      } else if (type === "toggle_replay_buffer") {
        cmd.toggle_replay_buffer = true;
      } else if (type === "save_replay") {
        cmd.save_replay = true;
      } else if (type === "set_transition") {
        cmd.set_transition = params.name || "";
      } else if (type === "set_transition_duration") {
        cmd.set_transition_duration = parseInt(params.duration) || 300;
      } else if (type === "toggle_source_visibility") {
        cmd.toggle_source_visibility = params.source || "";
      } else if (type === "set_source_visibility") {
        cmd.set_source_visibility = { source: params.source || "", visible: params.visible !== false };
      } else if (type === "toggle_source_mute") {
        cmd.toggle_source_mute = params.source || "";
      } else if (type === "set_source_mute") {
        cmd.set_source_mute = { source: params.source || "", muted: params.muted !== false };
      } else if (type === "set_source_volume") {
        cmd.set_source_volume = { source: params.source || "", volume: parseFloat(params.volume) || 0 };
      } else if (type === "set_source_text") {
        cmd.set_source_text = { source: params.source || "", text: params.text || "" };
      } else if (type === "refresh_browser_source") {
        cmd.refresh_browser_source = params.source || "";
      } else if (type === "set_media_cursor") {
        cmd.set_media_cursor = { source: params.source || "", cursor: parseInt(params.cursor) || 0 };
      } else if (type === "enable_studio_mode") {
        cmd.enable_studio_mode = true;
      } else if (type === "disable_studio_mode") {
        cmd.disable_studio_mode = true;
      } else if (type === "toggle_studio_mode") {
        cmd.toggle_studio_mode = true;
      } else if (type === "set_scene_collection") {
        cmd.set_scene_collection = params.name || "";
      } else if (type === "set_profile") {
        cmd.set_profile = params.name || "";
      } else {
        cmd[type] = params;
      }

      Object.keys(cmd).forEach((k) => {
        fbDb.ref("commands").child(k).set(cmd[k]);
      });
    });
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
        renderGrid();
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
        renderGrid();
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
