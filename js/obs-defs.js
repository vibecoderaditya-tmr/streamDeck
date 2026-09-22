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

  const ACTIONS = [
    { value: "set_program_scene", label: "Set Program Scene", hasParam: "scene" },
    { value: "set_preview_scene", label: "Set Preview Scene", hasParam: "scene" },
    { value: "smart_scene_switch", label: "Smart Scene Switch", hasParam: "scene" },
    { value: "trigger_transition", label: "Trigger Transition", hasParam: false },
    { value: "set_transition", label: "Set Transition", hasParam: "name" },
    { value: "set_transition_duration", label: "Set Transition Duration (ms)", hasParam: "duration" },
    { value: "start_streaming", label: "Start Streaming", hasParam: false },
    { value: "stop_streaming", label: "Stop Streaming", hasParam: false },
    { value: "toggle_streaming", label: "Toggle Streaming", hasParam: false },
    { value: "start_recording", label: "Start Recording", hasParam: false },
    { value: "stop_recording", label: "Stop Recording", hasParam: false },
    { value: "toggle_recording", label: "Toggle Recording", hasParam: false },
    { value: "pause_recording", label: "Pause Recording", hasParam: false },
    { value: "unpause_recording", label: "Resume Recording", hasParam: false },
    { value: "toggle_pause_recording", label: "Toggle Pause Recording", hasParam: false },
    { value: "split_recording", label: "Split Recording", hasParam: false },
    { value: "record_chapter", label: "Create Record Chapter", hasParam: false },
    { value: "start_replay_buffer", label: "Start Replay Buffer", hasParam: false },
    { value: "stop_replay_buffer", label: "Stop Replay Buffer", hasParam: false },
    { value: "toggle_replay_buffer", label: "Toggle Replay Buffer", hasParam: false },
    { value: "save_replay", label: "Save Replay", hasParam: false },
    { value: "output_start", label: "Output Start", hasParam: "output" },
    { value: "output_stop", label: "Output Stop", hasParam: "output" },
    { value: "output_toggle", label: "Output Toggle", hasParam: "output" },
    { value: "enable_studio_mode", label: "Enable Studio Mode", hasParam: false },
    { value: "disable_studio_mode", label: "Disable Studio Mode", hasParam: false },
    { value: "toggle_studio_mode", label: "Toggle Studio Mode", hasParam: false },
    { value: "set_scene_collection", label: "Set Scene Collection", hasParam: "name" },
    { value: "set_profile", label: "Set Profile", hasParam: "name" },
    { value: "toggle_source_visibility", label: "Toggle Source Visibility", hasParam: "source" },
    { value: "set_source_visibility", label: "Set Source Visibility", hasParam: "source,visible" },
    { value: "set_source_transform", label: "Set Source Transform", hasParam: "source,x,y,scaleX,scaleY,rotation" },
    { value: "set_filter_visibility", label: "Set Filter Visibility", hasParam: "source,filter,visible" },
    { value: "toggle_source_mute", label: "Toggle Source Mute", hasParam: "source" },
    { value: "set_source_mute", label: "Set Source Mute", hasParam: "source,muted" },
    { value: "set_source_volume", label: "Set Source Volume (dB)", hasParam: "source,volume" },
    { value: "adjust_volume", label: "Adjust Volume by dB", hasParam: "source,delta" },
    { value: "set_audio_sync", label: "Set Audio Sync Offset (ms)", hasParam: "source,offset" },
    { value: "set_audio_balance", label: "Set Audio Balance (0-1)", hasParam: "source,balance" },
    { value: "set_audio_monitor", label: "Set Audio Monitor", hasParam: "source,type" },
    { value: "set_source_text", label: "Set Source Text", hasParam: "source,text" },
    { value: "refresh_browser_source", label: "Refresh Browser Source", hasParam: "source" },
    { value: "reset_video_capture", label: "Reset Video Capture Device", hasParam: "source" },
    { value: "take_screenshot", label: "Take Screenshot", hasParam: "source" },
    { value: "media_play", label: "Media: Play", hasParam: "source" },
    { value: "media_pause", label: "Media: Pause", hasParam: "source" },
    { value: "media_restart", label: "Media: Restart", hasParam: "source" },
    { value: "media_stop", label: "Media: Stop", hasParam: "source" },
    { value: "media_next", label: "Media: Next", hasParam: "source" },
    { value: "media_prev", label: "Media: Previous", hasParam: "source" },
    { value: "set_media_cursor", label: "Set Media Cursor (ms)", hasParam: "source,cursor" },
    { value: "trigger_hotkey", label: "Trigger Hotkey by Name", hasParam: "name" },
    { value: "custom_command", label: "Custom OBS-WS Command", hasParam: "requestType,requestData" },
    { value: "start_virtual_cam", label: "Start Virtual Camera", hasParam: false },
    { value: "stop_virtual_cam", label: "Stop Virtual Camera", hasParam: false },
    { value: "toggle_virtual_cam", label: "Toggle Virtual Camera", hasParam: false },
  ];

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

  global.OBS_DEFS = { ACTIONS: ACTIONS, FEEDBACKS: FEEDBACKS, PRESETS: PRESETS, migrateButton: migrateButton, flatActions: flatActions, flatFeedbacks: flatFeedbacks };
})(typeof window !== "undefined" ? window : globalThis);
