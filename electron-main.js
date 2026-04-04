const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let mainWindow    = null;
let serverProcess = null;
let serverPort    = 3000;
let serverStatus  = "starting"; // starting | running | stopped | error
let _restartTimer = null;
const MAX_RESTARTS = 10;
let _restartCount  = 0;

// ── Chemins ──────────────────────────────────────────────────────────────────
// userData = ~/Library/Application Support/DashboardJeux/
// Contient tous les fichiers modifiables : config, contacts, licence, logs, runtime.
// Survit aux mises à jour de l'app.

function getUserData() {
  return app.getPath("userData");
}

function getConfigPath() {
  return path.join(getUserData(), "app-config.json");
}

// ── Premier lancement : copie la config par défaut si absente ────────────────
function ensureUserData() {
  const userData   = getUserData();
  const configDest = getConfigPath();
  fs.mkdirSync(userData, { recursive: true });

  if (!fs.existsSync(configDest)) {
    const defaultCfg = path.join(__dirname, "app-config.json");
    if (fs.existsSync(defaultCfg)) {
      fs.copyFileSync(defaultCfg, configDest);
      console.log("[init] Config copiée vers userData :", configDest);
    }
  }
}

// ── Config ───────────────────────────────────────────────────────────────────

function readConfig() {
  try { return JSON.parse(fs.readFileSync(getConfigPath(), "utf8")); }
  catch { return {}; }
}

function readPort() {
  return readConfig().server?.port || 3000;
}

function writePort(newPort) {
  const cfg = readConfig();
  if (!cfg.server) cfg.server = {};
  cfg.server.port = parseInt(newPort);
  const tmp = getConfigPath() + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2));
  fs.renameSync(tmp, getConfigPath());
}

// ── Server ───────────────────────────────────────────────────────────────────

function startServer() {
  serverPort   = readPort();
  serverStatus = "starting";

  // En mode packagé (asar=false), __dirname = .app/Contents/Resources/app/
  // En dev, __dirname = dossier du projet
  const serverPath = path.join(__dirname, "server.js");

  // ELECTRON_RUN_AS_NODE=1 → Electron se comporte comme Node pour ce processus
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: __dirname,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NO_AUTO_OPEN:         "1",
      APP_DATA_PATH:        getUserData(),   // chemin userData passé au serveur
    }
  });

  serverProcess.stdout.on("data", (data) => {
    const msg = data.toString();
    console.log("[server]", msg.trim());
    if (msg.includes("Studio Control local")) {
      serverStatus  = "running";
      _restartCount = 0;
      sendStatus();
    }
  });

  serverProcess.stderr.on("data", (data) => {
    console.error("[server-err]", data.toString().trim());
  });

  serverProcess.on("exit", (code) => {
    console.log("[server] exited:", code);
    if (code === 0) {
      serverStatus = "stopped";
      sendStatus();
      return;
    }
    serverStatus = "error";
    sendStatus();
    if (_restartCount >= MAX_RESTARTS) {
      console.error("[server] Trop de redémarrages, abandon.");
      return;
    }
    _restartCount++;
    const delay = Math.min(1000 * _restartCount, 15000);
    console.log(`[server] Redémarrage dans ${delay}ms (${_restartCount}/${MAX_RESTARTS})…`);
    clearTimeout(_restartTimer);
    _restartTimer = setTimeout(() => { startServer(); sendStatus(); }, delay);
  });
}

function sendStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("status-update", { status: serverStatus, port: serverPort });
  }
}

// ── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width:     400,
    height:    460,
    resizable: false,
    title:     "DashboardJeux",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      nodeIntegration:  true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "launcher.html"));

  mainWindow.on("close", (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

// Une seule instance à la fois — si une 2ème tente de démarrer,
// on affiche la fenêtre existante et on quitte la nouvelle.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
    ensureUserData();
    startServer();
    createWindow();
  });

  app.on("activate", () => { if (mainWindow) mainWindow.show(); });

  app.on("before-quit", () => {
    if (serverProcess) { serverProcess.kill(); serverProcess = null; }
  });
}

// ── IPC ───────────────────────────────────────────────────────────────────────

ipcMain.handle("get-state",   () => ({ status: serverStatus, port: serverPort }));
ipcMain.handle("launch-gui",  () => shell.openExternal(`http://localhost:${serverPort}`));

ipcMain.handle("change-port", (_, newPort) => {
  const p = parseInt(newPort);
  if (!p || p < 1024 || p > 65535) return { ok: false, error: "Port invalide (1024–65535)" };
  writePort(p);
  serverPort = p;
  return { ok: true };
});

ipcMain.handle("restart-server", () => {
  if (serverProcess) serverProcess.kill();
  setTimeout(() => { startServer(); sendStatus(); }, 800);
});

ipcMain.handle("hide", () => mainWindow.hide());

ipcMain.handle("quit", () => {
  if (serverProcess) serverProcess.kill();
  app.exit(0);
});
