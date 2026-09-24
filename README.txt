============================================
  OBS Remote Director - Setup Guide
============================================

WHAT THIS IS:
  A remote control system for OBS Studio that lets
  2+ team members control one broadcast PC from
  any browser, anywhere in the world.

  Think "Bitfocus Companion" but simpler and remote-first.

  - Bridge EXE runs on the OBS PC
  - Firebase Realtime Database = message broker (no port forwarding)
  - Web panel = your control surface (deck) and editor (admin)
  - PIN protection (UI-level only)

============================================
PREREQUISITES
============================================

  1. OBS Studio 28+ (WebSocket v5 built-in)
  2. Python 3.9+ (for the bridge)
  3. A Firebase project (free tier works)
  4. Node.js (for Vercel deploy, optional)

============================================
STEP 1: OBS SETUP
============================================

  1. Open OBS Studio
  2. Go to Tools > WebSocket Server Settings
  3. Enable WebSocket server
  4. Set port to 4455
  5. Set a password (note it down)
  6. Enable "Allow connection from localhost only"
      (uncheck if you want LAN access too)

  For remote access, you may need:
  - OBS WebSocket 5.x (built into OBS 28+)
  - Or obs-websocket installed separately

============================================
STEP 2: FIREBASE SETUP
============================================

  1. Go to https://console.firebase.google.com
  2. Create a new project (or use existing)
  3. Enable Realtime Database
  4. Set database rules to allow open access:

     {
       "rules": {
         ".read": true,
         ".write": true
       }
     }

  5. Note your database URL:
     https://YOUR-PROJECT-ID-default-rtdb.firebaseio.com

  WARNING: Open rules mean anyone with your DB URL can
  read/write. This is fine for internal tools but NOT
  for public-facing deployments.

============================================
STEP 3: CONFIGURE & RUN BRIDGE
============================================

  CONFIG FILES (2 separate files):

  1. bridge/firebase_config.json (DO NOT EDIT, shipped with EXE)
     Contains Firebase URL — this stays hidden inside the EXE.

  2. bridge/obs_config.json (user-editable, auto-created on first run)
     Contains only OBS settings:

     {
       "host": "127.0.0.1",
       "port": 4455,
       "password": "YOUR_OBS_WS_PASSWORD"
     }

  RUN FROM SOURCE:

  1. Install Python dependencies:

     cd bridge
     pip install -r requirements.txt

  2. Run the bridge:

     python obs_bridge.py

     On first run, obs_config.json is auto-created with defaults.
     Edit it with your OBS WebSocket password, then restart.

  BUILD EXE (for distribution):

  1. Run: build.bat
  2. Output: dist/OBS Bridge.exe + dist/obs_config.json
  3. firebase_config.json is bundled INSIDE the EXE (hidden)
  4. obs_config.json is copied alongside (user edits this)
  5. Send both files to the other OBS operator

  DISTRIBUTING TO OTHERS:

  What you send them:
    - OBS Bridge.exe
    - obs_config.json

  What they do:
    1. Put both files in the same folder
    2. Edit obs_config.json — set their OBS WebSocket password
    3. Run OBS Bridge.exe
    4. It auto-connects to their OBS + your Firebase

  What they DON'T see:
    - Firebase URL (hidden inside EXE)
    - Your Firebase project details
    - Any auth tokens

  4. The bridge will:
     - Connect to OBS
     - Create default pages/buttons in Firebase
     - Show a system tray icon
     - Sync OBS state to Firebase in real-time
     - Listen for commands from the web panel

  5. Check the bridge logs in bridge/logs/bridge.log

============================================
STEP 4: DEPLOY WEB PANEL
============================================

  Option A: Vercel (recommended)

  1. Push the panel/ folder to a GitHub repo
  2. Go to https://vercel.com
  3. Import the GitHub repo
  4. Set root directory to "panel"
  5. Deploy
  6. Your URL: https://your-project.vercel.app

  Option B: Firebase Hosting

  1. Install Firebase CLI: npm install -g firebase-tools
  2. cd panel
  3. firebase init hosting
  4. firebase deploy

  Option C: Any static host

  Just serve the panel/ folder with any HTTP server.
  Make sure both index.html and admin.html are accessible.

============================================
STEP 5: USE IT
============================================

  DECK (Control Surface):
    https://your-url/index.html
    Enter PIN: 2448

    - Click tiles to trigger actions
    - Click ⛶ for fullscreen mode
    - Click ⚙ to configure which pages to show
    - Bookmark with query params for per-person layouts

  ADMIN (Editor):
    https://your-url/admin.html
    Enter PIN: 2448

    - Left panel: button grid + page nav + toolbar
    - Right panel: edit button (Step 1, Style, Feedbacks)
    - Pages tab: manage pages
    - Presets tab: drag-and-drop preset buttons
    - Keyboard shortcuts: arrows, Delete, Ctrl+C/V, PageUp/Down

============================================
FIREBASE DATA STRUCTURE
============================================

  /pages
    page_0: { name: "Scenes", order: 0 }
    page_1: { name: "Camera", order: 1 }

  /buttons
    page_0:
      0_0: { label, icon, actions[], feedbacks[], style }
      0_1: { ... }

  /status
    scene: "Main"           (current program scene)
    previewScene: "Intro"   (current preview scene)
    streaming: true/false
    recording: true/false
    paused: true/false
    replayBuffer: true/false
    studioMode: true/false
    scenes: ["Main", "Intro", ...]
    sources: { "Camera": { visible: true, muted: false } }
    connected: true/false
    error: ""

  /commands
    set_program_scene: "Main"
    toggle_streaming: true
    (cleared after execution)

  /config (auto-created on first run)
    adminPin: "2448"

============================================
TROUBLESHOOTING
============================================

  Bridge won't connect to OBS:
  - Check OBS is running
  - Check WebSocket server is enabled
  - Check host/port/password in obs_config.json
  - Check firewall isn't blocking port 4455

  Web panel shows "Disconnected":
  - Bridge may not be running
  - Check Firebase URL in both bridge config and firebase-config.js
  - Open browser console for errors

  Feedback colors not working:
  - Ensure OBS Studio Mode is enabled (View > Studio Mode)
  - Ensure bridge is connected (check /status in Firebase console)

  Buttons not saving:
  - Check Firebase rules allow writes
  - Check browser console for errors

============================================
SECURITY NOTE
============================================

  Firebase key is hidden inside the EXE (bundled at build time).
  Users only see obs_config.json with their OBS settings.

  This system uses open Firebase rules + UI-level PIN.
  It is suitable for:
  - Internal team use
  - Trusted networks
  - Quick deployment

  It is NOT suitable for:
  - Public-facing deployments
  - Untrusted users
  - High-security environments

  For stronger security, add Firebase Authentication
  and update the RTDB rules accordingly.

============================================
FILES
============================================

  bridge/
    obs_bridge.py          Main bridge (Python)
    firebase_config.json   Firebase URL (hidden inside EXE)
    obs_config.json        OBS settings (user-editable, auto-created)
    requirements.txt       Python dependencies
    build.bat              EXE builder

  panel/
    index.html             Deck page (control surface)
    admin.html             Admin page (editor)
    css/style.css          Stylesheet
    js/firebase-config.js  Firebase config + PIN
    js/deck.js             Deck page logic
    js/admin.js            Admin page logic
    vercel.json            Vercel deploy config

  firebase/
    database.rules.json    RTDB security rules

============================================
