const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require("electron");
const path = require("path");

// Keep background processing active
app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");

let mainWin;
let blockerWin;
let trackingWin;
let tray;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1100,
    height: 850,
    autoHideMenuBar: true,
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWin.loadFile(path.join(__dirname, "app", "index.html"));

  // Hide instead of minimize/close
  mainWin.on("minimize", (e) => {
    e.preventDefault();
    mainWin.hide();
  });

  mainWin.on("close", (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWin.hide();
    }
  });
}

function createNailBiteBlockerWindow() {
  const { width, height } = screen.getPrimaryDisplay().bounds;

  blockerWin = new BrowserWindow({
    width,
    height,
    fullscreen: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  blockerWin.setMenuBarVisibility(false);
  blockerWin.loadFile(path.join(__dirname, "app", "blocker.html"));

  blockerWin.on("blur", () => {
    if (blockerWin.isVisible()) {
      blockerWin.setAlwaysOnTop(true, "screen-saver");
      blockerWin.focus();
    }
  });
}

function createTrackingLostWindow() {
  // Small always-on-top popup in center
  trackingWin = new BrowserWindow({
    width: 560,
    height: 330,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    backgroundColor: "#111111",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  trackingWin.setMenuBarVisibility(false);
  trackingWin.loadFile(path.join(__dirname, "app", "tracking.html"));

  trackingWin.on("blur", () => {
    if (trackingWin.isVisible()) {
      trackingWin.setAlwaysOnTop(true, "screen-saver");
      trackingWin.focus();
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, "app", "icon.png");
  const trayIcon = nativeImage.createFromPath(iconPath);
  tray = new Tray(trayIcon);

  const menu = Menu.buildFromTemplate([
    {
      label: "Show app",
      click: () => {
        mainWin.show();
        mainWin.focus();
      }
    },
    { type: "separator" },
    {
      label: "Pause 10 min",
      click: () => mainWin.webContents.send("PAUSE", { minutes: 10 })
    },
    {
      label: "Pause 30 min",
      click: () => mainWin.webContents.send("PAUSE", { minutes: 30 })
    },
    {
      label: "Resume",
      click: () => mainWin.webContents.send("RESUME")
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        app.isQuiting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip("Stop Biting Nails App");
  tray.setContextMenu(menu);
  tray.on("double-click", () => {
    mainWin.show();
    mainWin.focus();
  });
}

// ---- IPC: Nail-bite blocker ----
ipcMain.on("BLOCK_SHOW", () => {
  if (!blockerWin || blockerWin.isDestroyed()) createNailBiteBlockerWindow();
  blockerWin.show();
  blockerWin.focus();
  blockerWin.setAlwaysOnTop(true, "screen-saver");
});

ipcMain.on("BLOCK_HIDE", () => {
  if (blockerWin && !blockerWin.isDestroyed()) blockerWin.hide();
});

// ---- IPC: Tracking-lost popup ----
ipcMain.on("TRACK_SHOW", () => {
  if (!trackingWin || trackingWin.isDestroyed()) createTrackingLostWindow();
  // Position in bottom-right corner
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const [winWidth, winHeight] = trackingWin.getSize();
  const margin = 20;
  trackingWin.setPosition(
    screenWidth - winWidth - margin,
    screenHeight - winHeight - margin
  );
  trackingWin.show();
  trackingWin.focus();
  trackingWin.setAlwaysOnTop(true, "screen-saver");
});

ipcMain.on("TRACK_HIDE", () => {
  if (trackingWin && !trackingWin.isDestroyed()) trackingWin.hide();
});

ipcMain.on("TRACK_SNOOZE", (_evt, { minutes }) => {
  if (trackingWin && !trackingWin.isDestroyed()) trackingWin.hide();
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send("TRACK_SNOOZE_EVT", { minutes });
});

ipcMain.on("TRACK_OK", () => {
  if (trackingWin && !trackingWin.isDestroyed()) trackingWin.hide();
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send("TRACK_OK");
});

// ---- IPC: Pause/resume from nail-bite blocker window ----
ipcMain.on("PAUSE_REQUEST", (_evt, { minutes }) => {
  if (blockerWin && !blockerWin.isDestroyed()) blockerWin.hide();
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send("PAUSE", { minutes });
});

ipcMain.on("RESUME_REQUEST", () => {
  if (blockerWin && !blockerWin.isDestroyed()) blockerWin.hide();
  if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send("RESUME");
});

app.whenReady().then(() => {
  createMainWindow();
  createNailBiteBlockerWindow();
  createTrackingLostWindow();
  createTray();

  // Start with Windows login (only works for packaged app)
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: app.getPath("exe"),
      args: ["--hidden"]
    });
  }

  // Check if launched with --hidden flag (auto-start)
  if (process.argv.includes("--hidden")) {
    mainWin.hide();
  }
});

app.on("window-all-closed", () => {
  // keep running
});