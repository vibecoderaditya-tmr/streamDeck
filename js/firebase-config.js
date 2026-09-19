const FIREBASE_CONFIG = {
  databaseURL: "https://stream-deck-7460e-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const PIN_CODE = "2448";

let fbApp, fbDb;
try {
  fbApp = firebase.initializeApp(FIREBASE_CONFIG);
  fbDb = firebase.database();
} catch (e) {
  console.error("Firebase init failed:", e);
}
