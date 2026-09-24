/* ═══════════════════════════════════════════════════════════════
   OBS defs — shared Action / Feedback / Preset catalogue (OBS-only Companion)
   Static file: served by Vercel as-is, zero CPU. Loaded by deck.js + admin.js.
   Button model (Companion-like, backward compatible):
     old: {label, icon, actions:[], feedbacks:[], style}
     new: {label, icon, style, steps:[{actions:[{type,params,delayMs}], feedbacks:[...]}], stepMode}
   normalizeButton() migrates old → new in memory.
   ═══════════════════════════════════════════════════════════════ */
(function (global) {
  "use strict";

  // THE general solution: every action declares its OBS-WebSocket request here.
  // req   = OBS request name, or "LOGIC:<handler>" for bridge-side logic
  //         (read-modify-write, name→scene/item resolve, multi-call sequences).
  // map   = {friendlyParam: "ObsField"}.
  // num/int/bool = coerce these friendly params from strings.
  // fixed = constant OBS fields merged into every call.
  // settingsFrom = "rest": dump all unmapped params into this object field
  //         (used by SetInputSettings → inputSettings).
  // To support a brand-new OBS request tomorrow: add ONE line below. No
  // deck.js or bridge changes needed — both sides read this table.
  const ACTIONS = [
    { value: "set_program_scene", label: "Set Program Scene", hasParam: "scene", req: "SetCurrentProgramScene", map: { scene: "sceneName" } },
    { value: "set_preview_scene", label: "Set Preview Scene", hasParam: "scene", req: "SetCurrentPreviewScene", map: { scene: "sceneName" } },
    { value: "smart_scene_switch", label: "Smart Scene Switch", hasParam: "scene", req: "LOGIC:smart_scene_switch" },
    { value: "trigger_transition", label: "Trigger Transition", hasParam: false, req: "TriggerStudioModeTransition", map: {} },
    { value: "quick_transition", label: "Quick Transition", hasParam: "transition", req: "LOGIC:quick_transition" },
    { value: "set_transition", label: "Set Transition", hasParam: "name", req: "SetCurrentSceneTransition", map: { name: "transitionName" } },
    { value: "set_transition_duration", label: "Set Transition Duration (ms)", hasParam: "duration", req: "SetCurrentSceneTransitionDuration", map: { duration: "transitionDuration" }, int: ["duration"] },
    { value: "start_streaming", label: "Start Streaming", hasParam: false, req: "StartStream", map: {} },
    { value: "stop_streaming", label: "Stop Streaming", hasParam: false, req: "StopStream", map: {} },
    { value: "toggle_streaming", label: "Toggle Streaming", hasParam: false, req: "ToggleStream", map: {} },
    { value: "start_recording", label: "Start Recording", hasParam: false, req: "StartRecord", map: {} },
    { value: "stop_recording", label: "Stop Recording", hasParam: false, req: "StopRecord", map: {} },
    { value: "toggle_recording", label: "Toggle Recording", hasParam: false, req: "ToggleRecord", map: {} },
    { value: "pause_recording", label: "Pause Recording", hasParam: false, req: "PauseRecord", map: {} },
    { value: "unpause_recording", label: "Resume Recording", hasParam: false, req: "ResumeRecord", map: {} },
    { value: "toggle_pause_recording", label: "Toggle Pause Recording", hasParam: false, req: "ToggleRecordPause", map: {} },
    { value: "split_recording", label: "Split Recording", hasParam: false, req: "SplitRecordFile", map: {} },
    { value: "record_chapter", label: "Create Record Chapter", hasParam: false, req: "CreateRecordChapter", map: {} },
    { value: "start_replay_buffer", label: "Start Replay Buffer", hasParam: false, req: "StartReplayBuffer", map: {} },
    { value: "stop_replay_buffer", label: "Stop Replay Buffer", hasParam: false, req: "StopReplayBuffer", map: {} },
    { value: "toggle_replay_buffer", label: "Toggle Replay Buffer", hasParam: false, req: "ToggleReplayBuffer", map: {} },
    { value: "save_replay", label: "Save Replay", hasParam: false, req: "SaveReplayBuffer", map: {} },
    { value: "output_start", label: "Output Start", hasParam: "output", req: "StartOutput", map: { output: "outputName" } },
    { value: "output_stop", label: "Output Stop", hasParam: "output", req: "StopOutput", map: { output: "outputName" } },
    { value: "output_toggle", label: "Output Toggle", hasParam: "output", req: "ToggleOutput", map: { output: "outputName" } },
    { value: "enable_studio_mode", label: "Enable Studio Mode", hasParam: false, req: "SetStudioModeEnabled", map: {}, fixed: { studioModeEnabled: true } },
    { value: "disable_studio_mode", label: "Disable Studio Mode", hasParam: false, req: "SetStudioModeEnabled", map: {}, fixed: { studioModeEnabled: false } },
    { value: "toggle_studio_mode", label: "Toggle Studio Mode", hasParam: false, req: "LOGIC:toggle_studio_mode" },
    { value: "set_scene_collection", label: "Set Scene Collection", hasParam: "name", req: "SetCurrentSceneCollection", map: { name: "sceneCollectionName" } },
    { value: "set_profile", label: "Set Profile", hasParam: "name", req: "SetCurrentProfile", map: { name: "profileName" } },
    { value: "toggle_source_visibility", label: "Toggle Source Visibility", hasParam: "source", req: "LOGIC:toggle_source_visibility" },
    { value: "set_source_visibility", label: "Set Source Visibility", hasParam: "source,visible", req: "LOGIC:set_source_visibility" },
    { value: "set_source_transform", label: "Set Source Transform", hasParam: "source,x,y,scaleX,scaleY,rotation", req: "LOGIC:set_source_transform" },
    { value: "set_filter_visibility", label: "Set Filter Visibility", hasParam: "source,filter,visible", req: "SetSourceFilterEnabled", map: { source: "sourceName", filter: "filterName", visible: "filterEnabled" }, bool: ["visible"] },
    { value: "toggle_source_mute", label: "Toggle Source Mute", hasParam: "source", req: "ToggleInputMute", map: { source: "inputName" } },
    { value: "set_source_mute", label: "Set Source Mute", hasParam: "source,muted", req: "SetInputMute", map: { source: "inputName", muted: "inputMuted" }, bool: ["muted"] },
    { value: "set_source_volume", label: "Set Source Volume (dB)", hasParam: "source,volume", req: "SetInputVolume", map: { source: "inputName", volume: "inputVolumeDb" }, num: ["volume"] },
    { value: "adjust_volume", label: "Adjust Volume by dB", hasParam: "source,delta", req: "LOGIC:adjust_volume" },
    { value: "set_audio_sync", label: "Set Audio Sync Offset (ms)", hasParam: "source,offset", req: "SetInputAudioSyncOffset", map: { source: "inputName", offset: "inputAudioSyncOffset" }, int: ["offset"] },
    { value: "set_audio_balance", label: "Set Audio Balance (0-1)", hasParam: "source,balance", req: "SetInputAudioBalance", map: { source: "inputName", balance: "inputAudioBalance" }, num: ["balance"] },
    { value: "set_audio_monitor", label: "Set Audio Monitor", hasParam: "source,type", req: "SetInputAudioMonitorType", map: { source: "inputName", type: "monitorType" } },
    { value: "set_source_text", label: "Set Source Text", hasParam: "source,text", req: "SetInputSettings", map: { source: "inputName" }, settingsFrom: "rest", settingsKey: "inputSettings" },
    { value: "refresh_browser_source", label: "Refresh Browser Source", hasParam: "source", req: "PressInputPropertiesButton", map: { source: "inputName" }, fixed: { propertyName: "refreshnocache" } },
    { value: "reset_video_capture", label: "Reset Video Capture Device", hasParam: "source", req: "LOGIC:reset_video_capture" },
    { value: "take_screenshot", label: "Take Screenshot", hasParam: "source", req: "LOGIC:take_screenshot" },
    { value: "media_play", label: "Media: Play", hasParam: "source", req: "TriggerMediaInputAction", map: { source: "inputName" }, fixed: { mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY" } },
    { value: "media_pause", label: "Media: Pause", hasParam: "source", req: "TriggerMediaInputAction", map: { source: "inputName" }, fixed: { mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE" } },
    { value: "media_restart", label: "Media: Restart", hasParam: "source", req: "TriggerMediaInputAction", map: { source: "inputName" }, fixed: { mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART" } },
    { value: "media_stop", label: "Media: Stop", hasParam: "source", req: "TriggerMediaInputAction", map: { source: "inputName" }, fixed: { mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP" } },
    { value: "media_next", label: "Media: Next", hasParam: "source", req: "TriggerMediaInputAction", map: { source: "inputName" }, fixed: { mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NEXT" } },
    { value: "media_prev", label: "Media: Previous", hasParam: "source", req: "TriggerMediaInputAction", map: { source: "inputName" }, fixed: { mediaAction: "OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PREVIOUS" } },
    { value: "set_media_cursor", label: "Set Media Cursor (ms)", hasParam: "source,cursor", req: "SetMediaInputCursor", map: { source: "inputName", cursor: "mediaCursor" }, int: ["cursor"] },
    { value: "trigger_hotkey", label: "Trigger Hotkey by Name", hasParam: "name", req: "TriggerHotkeyByName", map: { name: "hotkeyName" } },
    { value: "custom_command", label: "Custom OBS-WS Command", hasParam: "requestType,requestData" },
    { value: "start_virtual_cam", label: "Start Virtual Camera", hasParam: false, req: "StartVirtualCam", map: {} },
    { value: "stop_virtual_cam", label: "Stop Virtual Camera", hasParam: false, req: "StopVirtualCam", map: {} },
    { value: "toggle_virtual_cam", label: "Toggle Virtual Camera", hasParam: false, req: "ToggleVirtualCam", map: {} },
  ];

  // Build the wire command for one button action using the table above.
  // Returns {key, value} for Firebase /commands. LOGIC:* and custom_command
  // pass through untouched for the bridge's logic handlers.
  function buildCommand(act) {
    const type = act.type;
    const params = act.params || {};
    if (type === "custom_command") return { key: "custom_command", value: params };
    const def = ACTIONS.find(function (a) { return a.value === type; });
    if (!def || !def.req || def.req.indexOf("LOGIC:") === 0) {
      return { key: type, value: params }; // bridge logic handler / unknown: legacy path
    }
    const data = {};
    Object.keys(def.fixed || {}).forEach(function (k) { data[k] = def.fixed[k]; });
    const mapped = {};
    Object.keys(def.map || {}).forEach(function (fp) {
      const obsF = def.map[fp];
      let v = params[fp];
      if (v === undefined || v === null || v === "") return;
      if ((def.num || []).indexOf(fp) >= 0) { v = parseFloat(v); if (isNaN(v)) return; }
      if ((def.int || []).indexOf(fp) >= 0) { v = parseInt(v, 10); if (isNaN(v)) return; }
      if ((def.bool || []).indexOf(fp) >= 0) {
        v = (v === true || v === "true" || v === "1" || v === 1);
      }
      data[obsF] = v;
      mapped[fp] = true;
    });
    if (def.settingsFrom === "rest") {
      const rest = {};
      Object.keys(params).forEach(function (fp) {
        if (!mapped[fp] && params[fp] !== undefined && params[fp] !== "") rest[fp] = params[fp];
      });
      data[def.settingsKey || "inputSettings"] = rest;
    }
    return { key: "custom_command", value: { requestType: def.req, requestData: data } };
  }

  const FEEDBACKS = [
    { value: "scene_in_program", label: "Scene in Program", hasParam: "scene" },
    { value: "scene_in_preview", label: "Scene in Preview", hasParam: "scene" },
    { value: "streaming_active", label: "Streaming Active", hasParam: false },
    { value: "recording_active", label: "Recording Active", hasParam: false },
    { value: "recording_paused", label: "Recording Paused", hasParam: false },
    { value: "replay_buffer_active", label: "Replay Buffer Active", hasParam: false },
    { value: "output_active", label: "Output Active", hasParam: "output" },
    { value: "transition_active", label: "Transition In Progress", hasParam: false },
    { value: "studio_mode_active", label: "Studio Mode Active", hasParam: false },
    { value: "source_visible", label: "Source Visible", hasParam: "source" },
    { value: "source_muted", label: "Source Muted", hasParam: "source" },
    { value: "filter_enabled", label: "Filter Enabled", hasParam: "source,filter" },
    { value: "volume_exact", label: "Volume Exact (dB)", hasParam: "source,volume" },
    { value: "media_playing", label: "Media Playing", hasParam: "source" },
    { value: "profile_active", label: "Profile Active", hasParam: "name" },
    { value: "collection_active", label: "Scene Collection Active", hasParam: "name" },
  ];

  const PRESETS = [
    { cat: "Scenes", label: "Program", icon: "🎬", actions: [{ type: "set_program_scene", params: { scene: "" } }], feedbacks: [{ type: "scene_in_program", params: { scene: "" }, activeColor: "green" }] },
    { cat: "Scenes", label: "Preview", icon: "👁️", actions: [{ type: "set_preview_scene", params: { scene: "" } }], feedbacks: [{ type: "scene_in_preview", params: { scene: "" }, activeColor: "blue" }] },
    { cat: "Scenes", label: "Smart Switch", icon: "↔️", actions: [{ type: "smart_scene_switch", params: { scene: "" } }], feedbacks: [] },
    { cat: "Switching", label: "Transition", icon: "🔄", actions: [{ type: "trigger_transition", params: {} }], feedbacks: [{ type: "transition_active", params: {}, activeColor: "yellow" }] },
    { cat: "Switching", label: "Quick Transition", icon: "⚡", actions: [{ type: "quick_transition", params: { transition: "" } }], feedbacks: [{ type: "transition_active", params: {}, activeColor: "yellow" }] },
    { cat: "Switching", label: "Studio On", icon: "🎚️", actions: [{ type: "enable_studio_mode", params: {} }], feedbacks: [{ type: "studio_mode_active", params: {}, activeColor: "blue" }] },
    { cat: "Streaming", label: "Toggle Stream", icon: "📡", actions: [{ type: "toggle_streaming", params: {} }], feedbacks: [{ type: "streaming_active", params: {}, activeColor: "red" }] },
    { cat: "Recording", label: "Toggle Rec", icon: "⏺️", actions: [{ type: "toggle_recording", params: {} }], feedbacks: [{ type: "recording_active", params: {}, activeColor: "red" }] },
    { cat: "Recording", label: "Chapter", icon: "📑", actions: [{ type: "record_chapter", params: {} }], feedbacks: [] },
    { cat: "Replay", label: "Save Replay", icon: "💾", actions: [{ type: "save_replay", params: {} }], feedbacks: [] },
    { cat: "Sources", label: "Toggle Source", icon: "👁️", actions: [{ type: "toggle_source_visibility", params: { source: "" } }], feedbacks: [{ type: "source_visible", params: { source: "" }, activeColor: "green" }] },
    { cat: "Sources", label: "Toggle Mute", icon: "🔇", actions: [{ type: "toggle_source_mute", params: { source: "" } }], feedbacks: [{ type: "source_muted", params: { source: "" }, activeColor: "red" }] },
    { cat: "Media", label: "Play", icon: "▶️", actions: [{ type: "media_play", params: { source: "" } }], feedbacks: [{ type: "media_playing", params: { source: "" }, activeColor: "green" }] },
    { cat: "Media", label: "Pause", icon: "⏸️", actions: [{ type: "media_pause", params: { source: "" } }], feedbacks: [] },
  ];

  // Migrate old {actions,feedbacks} → new {steps:[{actions,feedbacks}]} in memory.
  function migrateButton(btn, key) {
    if (!btn) return btn;
    const out = Object.assign({}, btn);
    out.id = out.id || key;
    if (!Array.isArray(out.steps)) {
      out.steps = [{
        actions: Array.isArray(out.actions) ? out.actions : [],
        feedbacks: Array.isArray(out.feedbacks) ? out.feedbacks : [],
      }];
      delete out.actions;
      delete out.feedbacks;
    }
    out.steps = out.steps.map(function (s) {
      return {
        actions: Array.isArray(s.actions) ? s.actions : [],
        feedbacks: Array.isArray(s.feedbacks) ? s.feedbacks : [],
      };
    });
    if (!out.style) out.style = {};
    if (out.icon === undefined) out.icon = "";
    if (out.label === undefined) out.label = "";
    if (!out.stepMode) out.stepMode = "advance";
    return out;
  }

  function flatActions(btn) {
    const m = migrateButton(btn);
    const res = [];
    (m.steps || []).forEach(function (s) { (s.actions || []).forEach(function (a) { res.push(a); }); });
    return res;
  }

  function flatFeedbacks(btn) {
    const m = migrateButton(btn);
    const res = [];
    (m.steps || []).forEach(function (s) { (s.feedbacks || []).forEach(function (f) { res.push(f); }); });
    return res;
  }

  global.OBS_DEFS = { ACTIONS: ACTIONS, FEEDBACKS: FEEDBACKS, PRESETS: PRESETS, migrateButton: migrateButton, flatActions: flatActions, flatFeedbacks: flatFeedbacks, buildCommand: buildCommand };
})(typeof window !== "undefined" ? window : globalThis);
