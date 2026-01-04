const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("app", {
  // Nail-bite blocker
  showBlocker: () => ipcRenderer.send("BLOCK_SHOW"),
  hideBlocker: () => ipcRenderer.send("BLOCK_HIDE"),

  // Tracking-lost popup
  showTrackingLost: () => ipcRenderer.send("TRACK_SHOW"),
  hideTrackingLost: () => ipcRenderer.send("TRACK_HIDE"),
  snoozeTrackingAlerts: (minutes) => ipcRenderer.send("TRACK_SNOOZE", { minutes }),

  // From blocker window (pause/resume detection)
  pause: (minutes) => ipcRenderer.send("PAUSE_REQUEST", { minutes }),
  resume: () => ipcRenderer.send("RESUME_REQUEST"),

  // Events delivered to detector window
  onPause: (handler) => {
    ipcRenderer.removeAllListeners("PAUSE");
    ipcRenderer.on("PAUSE", (_evt, payload) => handler(payload));
  },
  onResume: (handler) => {
    ipcRenderer.removeAllListeners("RESUME");
    ipcRenderer.on("RESUME", () => handler());
  },

  // Tracking popup buttons -> detector
  onTrackingOk: (handler) => {
    ipcRenderer.removeAllListeners("TRACK_OK");
    ipcRenderer.on("TRACK_OK", () => handler());
  },
  onTrackingSnooze: (handler) => {
    ipcRenderer.removeAllListeners("TRACK_SNOOZE_EVT");
    ipcRenderer.on("TRACK_SNOOZE_EVT", (_evt, payload) => handler(payload));
  }
});