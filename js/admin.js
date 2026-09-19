/* ═══════════════════════════════════════════════════════════════
   OBS Admin — Admin Page Logic
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);

  /* ── State ─────────────────────────────────────────────────── */
  let pages = {};
  let pageOrder = [];
  let buttons = {};
  let status = {};
  let currentPageIdx = 0;
  let selectedKey = null;
  let clipboard = null;
  let moveMode = false;
  let swapMode = false;
  let saveTimer = null;

  /* ── Action Types ──────────────────────────────────────────── */
  const ACTION_TYPES = [
    { value: "set_program_scene", label: "Set Program Scene", hasParam: "scene", paramLabel: "Scene" },
    { value: "set_preview_scene", label: "Set Preview Scene", hasParam: "scene", paramLabel: "Scene" },
    { value: "smart_scene_switch", label: "Smart Scene Switch", hasParam: "scene", paramLabel: "Scene" },
    { value: "trigger_transition", label: "Trigger Transition", hasParam: false },
    { value: "start_streaming", label: "Start Streaming", hasParam: false },
    { value: "stop_streaming", label: "Stop Streaming", hasParam: false },
    { value: "toggle_streaming", label: "Toggle Streaming", hasParam: false },
    { value: "start_recording", label: "Start Recording", hasParam: false },
    { value: "stop_recording", label: "Stop Recording", hasParam: false },
    { value: "toggle_recording", label: "Toggle Recording", hasParam: false },
    { value: "pause_recording", label: "Pause Recording", hasParam: false },
    { value: "unpause_recording", label: "Unpause Recording", hasParam: false },
    { value: "toggle_pause_recording", label: "Toggle Pause Recording", hasParam: false },
    { value: "split_recording", label: "Split Recording", hasParam: false },
    { value: "start_replay_buffer", label: "Start Replay Buffer", hasParam: false },
    { value: "stop_replay_buffer", label: "Stop Replay Buffer", hasParam: false },
    { value: "toggle_replay_buffer", label: "Toggle Replay Buffer", hasParam: false },
    { value: "save_replay", label: "Save Replay", hasParam: false },
    { value: "set_transition", label: "Set Transition", hasParam: "name", paramLabel: "Transition Name" },
    { value: "set_transition_duration", label: "Set Transition Duration", hasParam: "duration", paramLabel: "Duration (ms)" },
    { value: "enable_studio_mode", label: "Enable Studio Mode", hasParam: false },
    { value: "disable_studio_mode", label: "Disable Studio Mode", hasParam: false },
    { value: "toggle_studio_mode", label: "Toggle Studio Mode", hasParam: false },
    { value: "set_scene_collection", label: "Set Scene Collection", hasParam: "name", paramLabel: "Collection Name" },
    { value: "set_profile", label: "Set Profile", hasParam: "name", paramLabel: "Profile Name" },
    { value: "toggle_source_visibility", label: "Toggle Source Visibility", hasParam: "source", paramLabel: "Source" },
    { value: "set_source_visibility", label: "Set Source Visibility", hasParam: "source,visible", paramLabel: "Source,Visible (true/false)" },
    { value: "toggle_source_mute", label: "Toggle Source Mute", hasParam: "source", paramLabel: "Source" },
    { value: "set_source_mute", label: "Set Source Mute", hasParam: "source,muted", paramLabel: "Source,Muted (true/false)" },
    { value: "set_source_volume", label: "Set Source Volume", hasParam: "source,volume", paramLabel: "Source,Volume (dB)" },
    { value: "set_source_text", label: "Set Source Text", hasParam: "source,text", paramLabel: "Source,Text" },
    { value: "refresh_browser_source", label: "Refresh Browser Source", hasParam: "source", paramLabel: "Source" },
    { value: "set_media_cursor", label: "Set Media Cursor", hasParam: "source,cursor", paramLabel: "Source,Cursor (ms)" },
    { value: "start_virtual_cam", label: "Start Virtual Camera", hasParam: false },
    { value: "stop_virtual_cam", label: "Stop Virtual Camera", hasParam: false },
    { value: "toggle_virtual_cam", label: "Toggle Virtual Camera", hasParam: false },
  ];

  /* ── Feedback Types ────────────────────────────────────────── */
  const FEEDBACK_TYPES = [
    { value: "scene_in_program", label: "Scene in Program", hasParam: "scene", paramLabel: "Scene" },
    { value: "scene_in_preview", label: "Scene in Preview", hasParam: "scene", paramLabel: "Scene" },
    { value: "streaming_active", label: "Streaming Active", hasParam: false },
    { value: "recording_active", label: "Recording Active", hasParam: false },
    { value: "recording_paused", label: "Recording Paused", hasParam: false },
    { value: "replay_buffer_active", label: "Replay Buffer Active", hasParam: false },
    { value: "source_visible", label: "Source Visible", hasParam: "source", paramLabel: "Source" },
    { value: "source_muted", label: "Source Muted", hasParam: "source", paramLabel: "Source" },
  ];

  const COLOR_PRESETS = [
    "green", "red", "blue", "yellow", "orange", "purple", "cyan", "white",
  ];

  const COLOR_HEX = {
    green: "#1e6f5c", red: "#c23b22", blue: "#2b4c7e", yellow: "#b7791f",
    orange: "#d97706", purple: "#6b21a8", cyan: "#0891b2", white: "#e0e0e0",
  };

  const ICON_GRID = [
    "🎬", "👁️", "↔️", "📡", "⏺️", "📷", "🎤", "🔊",
    "🖥️", "💡", "🎥", "▶️", "⏹️", "⏸️", "🔄", "💾",
    "🎬", "📋", "⚙️", "🎚️", "🖥️", "📹", "🎵", "🔊",
  ];

  /* ── Helpers ───────────────────────────────────────────────── */
  function norm(s) {
    return String(s || "").trim().toLowerCase();
  }

  function createSceneSelect(currentValue, onChange) {
    const sel = document.createElement("select");
    sel.className = "scene-select";
    const scenes = status.scenes || [];
    const val = currentValue || "";

    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "— select scene —";
    sel.appendChild(blank);

    scenes.forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      if (norm(name) === norm(val)) opt.selected = true;
      sel.appendChild(opt);
    });

    if (val && !scenes.some((s) => norm(s) === norm(val))) {
      const custom = document.createElement("option");
      custom.value = val;
      custom.textContent = val + " (custom)";
      custom.selected = true;
      sel.appendChild(custom);
    }

    const customOpt = document.createElement("option");
    customOpt.value = "__custom__";
    customOpt.textContent = "✏ Type custom...";
    sel.appendChild(customOpt);

    sel.addEventListener("change", () => {
      if (sel.value === "__custom__") {
        const name = prompt("Enter scene name:", val);
        if (name !== null && name.trim()) {
          onChange(name.trim());
        } else {
          sel.value = val;
        }
      } else {
        onChange(sel.value);
      }
    });

    return sel;
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
            out.feedbacks.push({ type: r.type || r.feedback, params: { scene: r.scene || r.value || "" }, activeColor: r.activeColor || "green" });
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

  /* ── PIN ───────────────────────────────────────────────────── */
  function initPin() {
    const overlay = $("#pin-overlay");
    const input = $("#pin-input");
    const btn = $("#pin-btn");
    const err = $("#pin-err");

    if (sessionStorage.getItem("adm_unlocked")) {
      overlay.classList.add("dk-hidden");
      initApp();
      return;
    }

    btn.addEventListener("click", () => {
      if (input.value === PIN_CODE) {
        sessionStorage.setItem("adm_unlocked", "1");
        overlay.classList.add("dk-hidden");
        initApp();
      } else {
        err.textContent = "Incorrect PIN";
        input.value = "";
        input.focus();
      }
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") btn.click();
    });
  }

  /* ── Init App ──────────────────────────────────────────────── */
  function initApp() {
    const screen = $("#app-screen");
    screen.classList.remove("dk-hidden");
    screen.classList.add("active");

    initFirebase();
    initTopTabs();
    initSubTabs();
    initToolbar();
    initPageNav();
    initKeyboard();
    initEditor();
    initPresets();
  }

  /* ── Firebase ──────────────────────────────────────────────── */
  function initFirebase() {
    if (!fbDb) return;

    fbDb.ref("pages").on("value", (snap) => {
      pages = snap.val() || {};
      buildPageOrder();
      renderGrid();
      renderPagesList();
      renderPageNav();
      updateEditor();
    });

    fbDb.ref("buttons").on("value", (snap) => {
      buttons = snap.val() || {};
      renderGrid();
      updateEditor();
    });

    // Liveness check: bridge writes status/heartbeat every ~2s.
    // If heartbeat is stale (>10s) the EXE is dead/killed even when
    // connected=true was left behind by a crash.
    function updateConnBadge() {
      const badge = $("#adm-conn-status");
      if (!badge) return;
      const age = Date.now() - (status.heartbeat || 0);
      const alive = !!status.connected && (status.heartbeat || 0) > 0 && age < 10000;
      badge.textContent = alive ? "Connected" : "Disconnected";
      badge.className = "adm-badge " + (alive ? "adm-badge-connected" : "adm-badge-disconnected");
    }
    setInterval(updateConnBadge, 2000);

    fbDb.ref("status").on("value", (snap) => {
      status = snap.val() || {};
      updateConnBadge();
      if (selectedKey) updateEditor();
    });
  }

  function savePage(pageId) {
    if (!pageId) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      // Per-page write: avoids wiping other pages when 2 admins edit at once
      fbDb.ref("buttons/" + pageId).set(buttons[pageId] || {});
    }, 300);
  }

  function saveButtons() {
    savePage(getCurrentPageId());
  }

  function savePageImmediate(pageId) {
    if (!pageId) return;
    clearTimeout(saveTimer);
    fbDb.ref("buttons/" + pageId).set(buttons[pageId] || {});
  }

  /* ── Page Management ───────────────────────────────────────── */
  function buildPageOrder() {
    pageOrder = Object.keys(pages).sort((a, b) => {
      const oa = pages[a].order ?? 0;
      const ob = pages[b].order ?? 0;
      return oa - ob;
    });
    if (currentPageIdx >= pageOrder.length) currentPageIdx = 0;
  }

  function getCurrentPageId() {
    return pageOrder[currentPageIdx] || null;
  }

  /* ── Grid Rendering ────────────────────────────────────────── */
  function renderGrid() {
    const grid = $("#grid");
    if (!grid) return;

    const inner = grid.querySelector(".admin-grid-inner") || document.createElement("div");
    inner.className = "admin-grid-inner";
    inner.innerHTML = "";

    const pageId = getCurrentPageId();
    if (!pageId) {
      inner.style.gridTemplateColumns = "repeat(4, 1fr)";
      grid.appendChild(inner);
      return;
    }

    const pageBtns = buttons[pageId] || {};
    const keys = Object.keys(pageBtns);
    let maxRow = 0, maxCol = 0;
    keys.forEach((k) => {
      const [r, c] = k.split("_").map(Number);
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;
    });

    const numCols = Math.max(maxCol + 1, 4);
    const numRows = Math.max(maxRow + 1, 3);
    inner.style.gridTemplateColumns = `repeat(${numCols}, 1fr)`;

    for (let r = 0; r < numRows; r++) {
      for (let c = 0; c < numCols; c++) {
        const key = `${r}_${c}`;
        const btnCfg = pageBtns[key];
        const div = document.createElement("div");
        div.className = "admin-tile";
        div.dataset.key = key;

        if (btnCfg) {
          const nb = normalizeButton(btnCfg, key);
          div.style.background = nb.style?.bg || "#2a2a2a";
          div.style.color = nb.style?.color || "#fff";
          if (nb.icon) {
            const icon = document.createElement("span");
            icon.className = "tile-icon";
            icon.textContent = nb.icon;
            div.appendChild(icon);
          }
          if (nb.label) {
            const lbl = document.createElement("span");
            lbl.className = "tile-label";
            lbl.textContent = nb.label;
            div.appendChild(lbl);
          }
        } else {
          div.classList.add("empty-tile");
        }

        const pos = document.createElement("span");
        pos.className = "tile-pos";
        pos.textContent = `${r},${c}`;
        div.appendChild(pos);

        if (selectedKey === key) div.classList.add("selected");

        div.addEventListener("click", () => handleTileClick(key));
        inner.appendChild(div);
      }
    }

    grid.innerHTML = "";
    grid.appendChild(inner);
  }

  /* ── Tile Click ────────────────────────────────────────────── */
  function handleTileClick(key) {
    if (moveMode) {
      if (selectedKey && selectedKey !== key) {
        moveButton(selectedKey, key);
      }
      moveMode = false;
      $(".tb-move")?.classList.remove("tb-active");
      return;
    }
    if (swapMode) {
      if (selectedKey && selectedKey !== key) {
        swapButtons(selectedKey, key);
      }
      swapMode = false;
      $(".tb-swap")?.classList.remove("tb-active");
      return;
    }
    selectedKey = key;
    renderGrid();
    updateEditor();
  }

  /* ── Toolbar ───────────────────────────────────────────────── */
  function initToolbar() {
    $("#tb-copy")?.addEventListener("click", copyTile);
    $("#tb-paste")?.addEventListener("click", pasteTile);
    $("#tb-move")?.addEventListener("click", () => {
      moveMode = !moveMode;
      swapMode = false;
      $(".tb-move")?.classList.toggle("tb-active", moveMode);
      $(".tb-swap")?.classList.remove("tb-active");
    });
    $("#tb-swap")?.addEventListener("click", () => {
      swapMode = !swapMode;
      moveMode = false;
      $(".tb-swap")?.classList.toggle("tb-active", swapMode);
      $(".tb-move")?.classList.remove("tb-active");
    });
    $("#tb-delete")?.addEventListener("click", deleteTile);
    $("#tb-reset")?.addEventListener("click", resetTile);
    $("#tb-wipe")?.addEventListener("click", wipePage);
  }

  function copyTile() {
    if (!selectedKey || !getCurrentPageId()) return;
    const pageBtns = buttons[getCurrentPageId()] || {};
    if (pageBtns[selectedKey]) {
      clipboard = JSON.parse(JSON.stringify(pageBtns[selectedKey]));
    }
  }

  function pasteTile() {
    if (!clipboard || !selectedKey || !getCurrentPageId()) return;
    if (!buttons[getCurrentPageId()]) buttons[getCurrentPageId()] = {};
    buttons[getCurrentPageId()][selectedKey] = JSON.parse(JSON.stringify(clipboard));
    saveButtons();
    renderGrid();
    updateEditor();
  }

  function moveButton(fromKey, toKey) {
    const pageId = getCurrentPageId();
    if (!pageId) return;
    if (!buttons[pageId]) return;
    const fromBtn = buttons[pageId][fromKey];
    if (!fromBtn) return;
    const toBtn = buttons[pageId][toKey];
    if (toBtn) {
      buttons[pageId][fromKey] = toBtn;
    } else {
      delete buttons[pageId][fromKey];
    }
    buttons[pageId][toKey] = fromBtn;
    selectedKey = toKey;
    saveButtons();
    renderGrid();
    updateEditor();
  }

  function swapButtons(key1, key2) {
    const pageId = getCurrentPageId();
    if (!pageId || !buttons[pageId]) return;
    const a = buttons[pageId][key1];
    const b = buttons[pageId][key2];
    if (a) buttons[pageId][key2] = a;
    if (b) buttons[pageId][key1] = b;
    if (!a && b) delete buttons[pageId][key2];
    if (a && !b) delete buttons[pageId][key1];
    saveButtons();
    renderGrid();
    updateEditor();
  }

  function deleteTile() {
    if (!selectedKey || !getCurrentPageId()) return;
    if (!buttons[getCurrentPageId()]) return;
    delete buttons[getCurrentPageId()][selectedKey];
    selectedKey = null;
    saveButtons();
    renderGrid();
    updateEditor();
  }

  function resetTile() {
    if (!selectedKey || !getCurrentPageId()) return;
    if (!buttons[getCurrentPageId()]) return;
    buttons[getCurrentPageId()][selectedKey] = {
      id: selectedKey,
      label: "",
      icon: "",
      actions: [],
      feedbacks: [],
      style: { bg: "#2a2a2a", color: "#ffffff", fontSize: 14 },
    };
    saveButtons();
    renderGrid();
    updateEditor();
  }

  function wipePage() {
    if (!getCurrentPageId()) return;
    if (!confirm("Wipe all buttons on this page?")) return;
    buttons[getCurrentPageId()] = {};
    selectedKey = null;
    saveButtons();
    renderGrid();
    updateEditor();
  }

  /* ── Page Nav ──────────────────────────────────────────────── */
  function initPageNav() {
    $("#pg-prev")?.addEventListener("click", () => {
      if (currentPageIdx > 0) {
        currentPageIdx--;
        selectedKey = null;
        renderGrid();
        renderPageNav();
        updateEditor();
      }
    });
    $("#pg-next")?.addEventListener("click", () => {
      if (currentPageIdx < pageOrder.length - 1) {
        currentPageIdx++;
        selectedKey = null;
        renderGrid();
        renderPageNav();
        updateEditor();
      }
    });
    $("#pg-add")?.addEventListener("click", addPage);
  }

  function renderPageNav() {
    const label = $("#pg-label");
    if (label) {
      const pid = getCurrentPageId();
      label.textContent = pid ? (pages[pid]?.name || `Page ${currentPageIdx + 1}`) : "No Pages";
    }
  }

  function addPage() {
    const idx = pageOrder.length;
    const name = prompt("Page name:", `Page ${idx + 1}`);
    if (!name) return;
    const id = `page_${Date.now()}`;
    pages[id] = { name, order: idx };
    buttons[id] = {};
    // Per-id writes: don't overwrite other pages
    fbDb.ref("pages/" + id).set(pages[id]);
    fbDb.ref("buttons/" + id).set({});
    currentPageIdx = pageOrder.length;
  }

  /* ── Top Tabs ──────────────────────────────────────────────── */
  function initTopTabs() {
    $$(".top-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".top-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const target = tab.dataset.tab;
        $$(".tab-content").forEach((tc) => tc.classList.remove("active"));
        $(`#tab-${target}`)?.classList.add("active");
      });
    });
  }

  /* ── Sub-tabs ──────────────────────────────────────────────── */
  function initSubTabs() {
    $$(".sub-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".sub-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const target = tab.dataset.subtab;
        $$(".subtab-content").forEach((sc) => sc.classList.remove("active"));
        $(`#subtab-${target}`)?.classList.add("active");
      });
    });
  }

  /* ── Keyboard Shortcuts ────────────────────────────────────── */
  function initKeyboard() {
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.tagName === "SELECT") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteTile();
      } else if (e.ctrlKey && e.key === "c") {
        e.preventDefault();
        copyTile();
      } else if (e.ctrlKey && e.key === "v") {
        e.preventDefault();
        pasteTile();
      } else if (e.key === "PageUp") {
        e.preventDefault();
        $("#pg-prev")?.click();
      } else if (e.key === "PageDown") {
        e.preventDefault();
        $("#pg-next")?.click();
      } else if (e.key === "Escape") {
        selectedKey = null;
        moveMode = false;
        swapMode = false;
        $(".tb-move")?.classList.remove("tb-active");
        $(".tb-swap")?.classList.remove("tb-active");
        renderGrid();
        updateEditor();
      } else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        moveSelection(e.key);
      }
    });
  }

  function moveSelection(dir) {
    if (!selectedKey) {
      selectedKey = "0_0";
      renderGrid();
      updateEditor();
      return;
    }
    let [r, c] = selectedKey.split("_").map(Number);
    if (dir === "ArrowUp") r = Math.max(0, r - 1);
    else if (dir === "ArrowDown") r++;
    else if (dir === "ArrowLeft") c = Math.max(0, c - 1);
    else if (dir === "ArrowRight") c++;
    selectedKey = `${r}_${c}`;
    renderGrid();
    updateEditor();
  }

  /* ── Editor ────────────────────────────────────────────────── */
  function initEditor() {
    $("#editor-dup")?.addEventListener("click", duplicateTile);
    $("#editor-clear")?.addEventListener("click", deleteTile);
    $("#ed-label")?.addEventListener("input", liveSave);
    $("#ed-icon")?.addEventListener("input", liveSave);
    $("#ed-bg")?.addEventListener("input", liveSave);
    $("#ed-color")?.addEventListener("input", liveSave);
    $("#ed-fontsize")?.addEventListener("input", liveSave);
    $("#ed-add-action")?.addEventListener("click", addAction);
    $("#ed-add-feedback")?.addEventListener("click", addFeedback);
    renderIconGrid();
  }

  function renderIconGrid() {
    const grid = $("#ed-icon-grid");
    if (!grid) return;
    grid.innerHTML = "";
    ICON_GRID.forEach((icon) => {
      const btn = document.createElement("button");
      btn.textContent = icon;
      btn.addEventListener("click", () => {
        const input = $("#ed-icon");
        if (input) {
          input.value = icon;
          liveSave();
        }
      });
      grid.appendChild(btn);
    });
  }

  function duplicateTile() {
    if (!selectedKey || !getCurrentPageId()) return;
    const pageBtns = buttons[getCurrentPageId()] || {};
    const btn = pageBtns[selectedKey];
    if (!btn) return;
    const pageId = getCurrentPageId();
    let [r, c] = selectedKey.split("_").map(Number);
    const newKey = `${r}_${c + 1}`;
    if (!buttons[pageId]) buttons[pageId] = {};
    buttons[pageId][newKey] = JSON.parse(JSON.stringify(btn));
    buttons[pageId][newKey].id = newKey;
    selectedKey = newKey;
    saveButtons();
    renderGrid();
    updateEditor();
  }

  /* ── Update Editor ─────────────────────────────────────────── */
  function updateEditor() {
    const emptyState = $("#editor-empty");
    const assignedState = $("#editor-assigned");
    if (!emptyState || !assignedState) return;

    if (!selectedKey || !getCurrentPageId()) {
      emptyState.classList.remove("dk-hidden");
      assignedState.classList.add("dk-hidden");
      return;
    }

    const pageId = getCurrentPageId();
    if (!buttons[pageId]) buttons[pageId] = {};

    let nb;
    if (buttons[pageId][selectedKey]) {
      nb = normalizeButton(buttons[pageId][selectedKey], selectedKey);
    } else {
      // Show blank editor WITHOUT writing to Firebase yet.
      // The button is only created on first real edit (liveSave/addAction/addFeedback/preset).
      nb = {
        id: selectedKey,
        label: "",
        icon: "",
        actions: [],
        feedbacks: [],
        style: { bg: "#2a2a2a", color: "#ffffff", fontSize: 14 },
      };
    }

    emptyState.classList.add("dk-hidden");
    assignedState.classList.remove("dk-hidden");

    const nb2 = normalizeButton(buttons[pageId][selectedKey], selectedKey);

    $("#editor-pos").textContent = selectedKey;
    $("#ed-label").value = nb2.label || "";
    $("#ed-icon").value = nb2.icon || "";
    $("#ed-bg").value = nb2.style?.bg || "#2a2a2a";
    $("#ed-color").value = nb2.style?.color || "#ffffff";
    $("#ed-fontsize").value = nb2.style?.fontSize || 14;

    renderActions(nb2.actions || []);
    renderFeedbacks(nb2.feedbacks || []);
    updatePreview(nb2);
    renderGrid();
  }

  function updatePreview(nb) {
    const preview = $("#ed-preview");
    if (!preview) return;
    preview.style.background = nb.style?.bg || "#2a2a2a";
    preview.style.color = nb.style?.color || "#fff";
    const iconEl = preview.querySelector(".ed-preview-icon");
    const lblEl = preview.querySelector(".ed-preview-label");
    if (iconEl) iconEl.textContent = nb.icon || "";
    if (lblEl) lblEl.textContent = nb.label || "Button";
    preview.style.fontSize = (nb.style?.fontSize || 14) + "px";
  }

  /* ── Actions Editor ────────────────────────────────────────── */
  function renderActions(actions) {
    const list = $("#ed-actions");
    if (!list) return;
    list.innerHTML = "";

    actions.forEach((act, idx) => {
      const row = document.createElement("div");
      row.className = "action-row";

      const sel = document.createElement("select");
      ACTION_TYPES.forEach((at) => {
        const opt = document.createElement("option");
        opt.value = at.value;
        opt.textContent = at.label;
        if (act.type === at.value) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", () => {
        actions[idx].type = sel.value;
        actions[idx].params = actions[idx].params || {};
        liveSave();
        renderActions(actions);
      });
      row.appendChild(sel);

      const atDef = ACTION_TYPES.find((a) => a.value === act.type);
      if (atDef && atDef.hasParam) {
        const paramFields = atDef.hasParam.split(",");
        paramFields.forEach((pf) => {
          if (pf === "scene") {
            const sceneSel = createSceneSelect(act.params?.[pf] || "", (val) => {
              act.params = act.params || {};
              act.params[pf] = val;
              liveSave();
            });
            row.appendChild(sceneSel);
          } else {
            const inp = document.createElement("input");
            inp.type = "text";
            inp.placeholder = atDef.paramLabel || pf;
            inp.value = act.params?.[pf] || "";
            inp.addEventListener("input", () => {
              act.params = act.params || {};
              act.params[pf] = inp.value;
              liveSave();
            });
            row.appendChild(inp);
          }
        });
      }

      const removeBtn = document.createElement("button");
      removeBtn.className = "action-remove";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => {
        actions.splice(idx, 1);
        liveSave();
        renderActions(actions);
      });
      row.appendChild(removeBtn);

      list.appendChild(row);
    });
  }

  function addAction() {
    const pageId = getCurrentPageId();
    if (!pageId || !selectedKey) return;
    const nb = getOrCreateButton(pageId, selectedKey);
    if (!nb.actions) nb.actions = [];
    nb.actions.push({ type: "set_program_scene", params: { scene: "" } });
    saveButtons();
    renderActions(nb.actions);
    updatePreview(nb);
    renderGrid();
  }

  /* ── Feedbacks Editor ──────────────────────────────────────── */
  function renderFeedbacks(feedbacks) {
    const list = $("#ed-feedbacks");
    if (!list) return;
    list.innerHTML = "";

    feedbacks.forEach((fb, idx) => {
      const row = document.createElement("div");
      row.className = "feedback-row";

      const header = document.createElement("div");
      header.className = "fb-header";

      const sel = document.createElement("select");
      FEEDBACK_TYPES.forEach((ft) => {
        const opt = document.createElement("option");
        opt.value = ft.value;
        opt.textContent = ft.label;
        if (fb.type === ft.value) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", () => {
        fb.type = sel.value;
        fb.params = fb.params || {};
        liveSave();
        renderFeedbacks(feedbacks);
      });
      header.appendChild(sel);

      const removeBtn = document.createElement("button");
      removeBtn.className = "fb-remove";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", () => {
        feedbacks.splice(idx, 1);
        liveSave();
        renderFeedbacks(feedbacks);
      });
      header.appendChild(removeBtn);
      row.appendChild(header);

      const fields = document.createElement("div");
      fields.className = "fb-fields";

      const fbDef = FEEDBACK_TYPES.find((f) => f.value === fb.type);
      if (fbDef && fbDef.hasParam) {
        const label = document.createElement("label");
        label.textContent = fbDef.paramLabel;
        fields.appendChild(label);

        const paramFields = fbDef.hasParam.split(",");
        paramFields.forEach((pf) => {
          if (pf === "scene") {
            const sceneSel = createSceneSelect(fb.params?.[pf] || "", (val) => {
              fb.params = fb.params || {};
              fb.params[pf] = val;
              liveSave();
            });
            fields.appendChild(sceneSel);
          } else {
            const inp = document.createElement("input");
            inp.type = "text";
            inp.placeholder = pf;
            inp.value = fb.params?.[pf] || "";
            inp.addEventListener("input", () => {
              fb.params = fb.params || {};
              fb.params[pf] = inp.value;
              liveSave();
            });
            fields.appendChild(inp);
          }
        });
      }

      const colorRow = document.createElement("div");
      colorRow.className = "fb-color-row";

      const colorLabel = document.createElement("label");
      colorLabel.textContent = "Active Color";
      colorRow.appendChild(colorLabel);

      const colorSel = document.createElement("select");
      COLOR_PRESETS.forEach((cp) => {
        const opt = document.createElement("option");
        opt.value = cp;
        opt.textContent = cp.charAt(0).toUpperCase() + cp.slice(1);
        if ((fb.activeColor || "green") === cp) opt.selected = true;
        colorSel.appendChild(opt);
      });
      colorSel.addEventListener("change", () => {
        fb.activeColor = colorSel.value;
        liveSave();
        renderFeedbacks(feedbacks);
      });
      colorRow.appendChild(colorSel);

      const swatch = document.createElement("div");
      swatch.className = "fb-color-swatch";
      swatch.style.background = COLOR_HEX[fb.activeColor || "green"] || "#1e6f5c";
      colorRow.appendChild(swatch);

      fields.appendChild(colorRow);
      row.appendChild(fields);
      list.appendChild(row);
    });
  }

  function addFeedback() {
    const pageId = getCurrentPageId();
    if (!pageId || !selectedKey) return;
    const nb = getOrCreateButton(pageId, selectedKey);
    if (!nb.feedbacks) nb.feedbacks = [];
    nb.feedbacks.push({ type: "scene_in_program", params: { scene: "" }, activeColor: "green" });
    saveButtons();
    renderFeedbacks(nb.feedbacks);
    updatePreview(nb);
  }

  /* ── Helpers ───────────────────────────────────────────────── */
  function getOrCreateButton(pageId, key) {
    if (!buttons[pageId]) buttons[pageId] = {};
    if (!buttons[pageId][key]) {
      buttons[pageId][key] = {
        id: key, label: "", icon: "",
        actions: [], feedbacks: [],
        style: { bg: "#2a2a2a", color: "#ffffff", fontSize: 14 },
      };
    }
    const nb = normalizeButton(buttons[pageId][key], key);
    buttons[pageId][key] = nb;
    return nb;
  }

  function liveSave() {
    const pageId = getCurrentPageId();
    if (!pageId || !selectedKey) return;
    const nb = getOrCreateButton(pageId, selectedKey);
    nb.label = $("#ed-label")?.value || "";
    nb.icon = $("#ed-icon")?.value || "";
    nb.style = {
      bg: $("#ed-bg")?.value || "#2a2a2a",
      color: $("#ed-color")?.value || "#ffffff",
      fontSize: parseInt($("#ed-fontsize")?.value) || 14,
    };
    saveButtons();
    updatePreview(nb);
    renderGrid();
  }

  /* ── Pages List ────────────────────────────────────────────── */
  function renderPagesList() {
    const list = $("#pages-list");
    if (!list) return;
    list.innerHTML = "";

    pageOrder.forEach((pid, idx) => {
      const page = pages[pid];
      const row = document.createElement("div");
      row.className = "page-row";

      const drag = document.createElement("span");
      drag.className = "pg-drag";
      drag.textContent = "⠿";
      row.appendChild(drag);

      const nameInput = document.createElement("input");
      nameInput.className = "pg-name";
      nameInput.value = page?.name || `Page ${idx + 1}`;
      nameInput.addEventListener("change", () => {
        if (pages[pid]) {
          pages[pid].name = nameInput.value;
          fbDb.ref("pages/" + pid + "/name").set(nameInput.value);
          renderPageNav();
        }
      });
      row.appendChild(nameInput);

      const count = document.createElement("span");
      count.className = "pg-count";
      const btnCount = Object.keys(buttons[pid] || {}).length;
      count.textContent = `${btnCount} buttons`;
      row.appendChild(count);

      const del = document.createElement("button");
      del.className = "pg-del";
      del.textContent = "✕";
      del.addEventListener("click", () => {
        if (!confirm(`Delete page "${page?.name}"?`)) return;
        delete pages[pid];
        delete buttons[pid];
        fbDb.ref("pages/" + pid).remove();
        fbDb.ref("buttons/" + pid).remove();
      });
      row.appendChild(del);

      list.appendChild(row);
    });

    // Bind once — renderPagesList runs on every Firebase update
    const pagesAddBtn = $("#pages-add");
    if (pagesAddBtn && !pagesAddBtn.dataset.bound) {
      pagesAddBtn.dataset.bound = "1";
      pagesAddBtn.addEventListener("click", addPage);
    }
  }

  /* ── Presets ───────────────────────────────────────────────── */
  const PRESETS = {
    "Scene Control": [
      { label: "Scene", icon: "🎬", actions: [{ type: "set_program_scene", params: { scene: "" } }], feedbacks: [{ type: "scene_in_program", params: { scene: "" }, activeColor: "green" }] },
      { label: "Preview", icon: "👁️", actions: [{ type: "set_preview_scene", params: { scene: "" } }], feedbacks: [{ type: "scene_in_preview", params: { scene: "" }, activeColor: "blue" }] },
      { label: "Smart Switch", icon: "↔️", actions: [{ type: "smart_scene_switch", params: { scene: "" } }] },
      { label: "Transition", icon: "🔄", actions: [{ type: "trigger_transition", params: {} }] },
    ],
    "Streaming": [
      { label: "Start Stream", icon: "📡", actions: [{ type: "start_streaming", params: {} }], feedbacks: [{ type: "streaming_active", params: {}, activeColor: "red" }] },
      { label: "Stop Stream", icon: "⏹️", actions: [{ type: "stop_streaming", params: {} }] },
      { label: "Toggle Stream", icon: "📡", actions: [{ type: "toggle_streaming", params: {} }], feedbacks: [{ type: "streaming_active", params: {}, activeColor: "red" }] },
    ],
    "Recording": [
      { label: "Start Rec", icon: "⏺️", actions: [{ type: "start_recording", params: {} }], feedbacks: [{ type: "recording_active", params: {}, activeColor: "red" }] },
      { label: "Stop Rec", icon: "⏹️", actions: [{ type: "stop_recording", params: {} }] },
      { label: "Toggle Rec", icon: "⏺️", actions: [{ type: "toggle_recording", params: {} }], feedbacks: [{ type: "recording_active", params: {}, activeColor: "red" }] },
      { label: "Pause Rec", icon: "⏸️", actions: [{ type: "pause_recording", params: {} }], feedbacks: [{ type: "recording_paused", params: {}, activeColor: "yellow" }] },
      { label: "Split Rec", icon: "✂️", actions: [{ type: "split_recording", params: {} }] },
    ],
    "Replay Buffer": [
      { label: "Start Replay", icon: "💾", actions: [{ type: "start_replay_buffer", params: {} }], feedbacks: [{ type: "replay_buffer_active", params: {}, activeColor: "cyan" }] },
      { label: "Stop Replay", icon: "⏹️", actions: [{ type: "stop_replay_buffer", params: {} }] },
      { label: "Save Replay", icon: "💾", actions: [{ type: "save_replay", params: {} }] },
    ],
    "Source Control": [
      { label: "Toggle Source", icon: "👁️", actions: [{ type: "toggle_source_visibility", params: { source: "" } }] },
      { label: "Toggle Mute", icon: "🔇", actions: [{ type: "toggle_source_mute", params: { source: "" } }] },
      { label: "Refresh Browser", icon: "🌐", actions: [{ type: "refresh_browser_source", params: { source: "" } }] },
    ],
    "Studio Mode": [
      { label: "Enable Studio", icon: "🎚️", actions: [{ type: "enable_studio_mode", params: {} }] },
      { label: "Disable Studio", icon: "🎚️", actions: [{ type: "disable_studio_mode", params: {} }] },
      { label: "Toggle Studio", icon: "🎚️", actions: [{ type: "toggle_studio_mode", params: {} }] },
    ],
    "Virtual Camera": [
      { label: "Start VCam", icon: "📷", actions: [{ type: "start_virtual_cam", params: {} }] },
      { label: "Stop VCam", icon: "📷", actions: [{ type: "stop_virtual_cam", params: {} }] },
      { label: "Toggle VCam", icon: "📷", actions: [{ type: "toggle_virtual_cam", params: {} }] },
    ],
  };

  function initPresets() {
    renderPresets();
    $("#preset-search")?.addEventListener("input", renderPresets);
  }

  function renderPresets() {
    const container = $("#presets-container");
    if (!container) return;
    container.innerHTML = "";

    const query = ($("#preset-search")?.value || "").toLowerCase();

    Object.entries(PRESETS).forEach(([category, items]) => {
      const filtered = items.filter((item) =>
        !query || item.label.toLowerCase().includes(query) || category.toLowerCase().includes(query)
      );
      if (!filtered.length) return;

      const cat = document.createElement("div");
      cat.className = "preset-category";

      const header = document.createElement("div");
      header.className = "preset-category-header";
      header.innerHTML = `<span class="pc-arrow">▶</span><span class="pc-name">${category}</span><span class="pc-count">${filtered.length}</span>`;
      header.addEventListener("click", () => {
        header.classList.toggle("open");
        itemsDiv.classList.toggle("open");
      });
      cat.appendChild(header);

      const itemsDiv = document.createElement("div");
      itemsDiv.className = "preset-items";

      filtered.forEach((preset) => {
        const item = document.createElement("div");
        item.className = "preset-item";
        item.draggable = true;
        item.innerHTML = `<span class="pi-icon">${preset.icon}</span><span class="pi-label">${preset.label}</span><span class="pi-type">${preset.actions[0]?.type || ""}</span>`;
        item.addEventListener("click", () => {
          if (!selectedKey || !getCurrentPageId()) {
            alert("Select a tile first, then click a preset to apply it.");
            return;
          }
          applyPreset(preset);
        });
        itemsDiv.appendChild(item);
      });

      cat.appendChild(itemsDiv);
      container.appendChild(cat);
    });
  }

  function applyPreset(preset) {
    const pageId = getCurrentPageId();
    if (!pageId || !selectedKey) return;
    const nb = getOrCreateButton(pageId, selectedKey);
    nb.label = preset.label;
    nb.icon = preset.icon;
    nb.actions = JSON.parse(JSON.stringify(preset.actions || []));
    nb.feedbacks = JSON.parse(JSON.stringify(preset.feedbacks || []));
    if (!nb.style || nb.style.bg === "#1a1a1a") {
      nb.style = { bg: "#2a2a2a", color: "#ffffff", fontSize: 14 };
    }
    saveButtons();
    updateEditor();
    renderGrid();
  }

  /* ── Boot ──────────────────────────────────────────────────── */
  document.addEventListener("DOMContentLoaded", initPin);
})();
