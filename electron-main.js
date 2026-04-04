const { app, BrowserWindow, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

let mainWindow = null;
let serverProcess = null;
let serverPort = 3000;
let serverStatus = "starting"; // starting | running | stopped | error

// ── Config ─────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(__dirname, "app-config.json");

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

function readPort() {
  return readConfig().server?.port || 3000;
}

function writePort(newPort) {
  const cfg = readConfig();
  if (!cfg.server) cfg.server = {};
  cfg.server.port = parseInt(newPort);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// ── Server ──────────────────────────────────────────────────────────────────

function startServer() {
  serverPort = readPort();
  serverStatus = "starting";

  const serverPath = path.join(__dirname, "server.js");
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: __dirname,
    env: { ...process.env, NO_AUTO_OPEN: "1" }
  });

  serverProcess.stdout.on("data", (data) => {
    const msg = data.toString();
    console.log("[server]", msg.trim());
    if (msg.includes("Studio Control local")) {
      serverStatus = "running";
      sendStatus();
    }
  });

  serverProcess.stderr.on("data", (data) => {
    console.error("[server-err]", data.toString().trim());
    serverStatus = "error";
    sendStatus();
  });

  serverProcess.on("exit", (code) => {
    console.log("[server] exited:", code);
    serverStatus = code === 0 ? "stopped" : "error";
    sendStatus();
  });
}

function sendStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("status-update", { status: serverStatus, port: serverPort });
  }
}

// ── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 460,
    resizable: false,
    title: "DashboardJeux",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "launcher.html"));

  // Cacher plutôt que fermer
  mainWindow.on("close", (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

// ── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  startServer();
  createWindow();
});

app.on("activate", () => {
  if (mainWindow) mainWindow.show();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

// ── IPC ─────────────────────────────────────────────────────────────────────

ipcMain.handle("get-state", () => ({
  status: serverStatus,
  port: serverPort
}));

ipcMain.handle("launch-gui", () => {
  shell.openExternal(`http://localhost:${serverPort}`);
});

ipcMain.handle("change-port", (_, newPort) => {
  const p = parseInt(newPort);
  if (!p || p < 1024 || p > 65535) return { ok: false, error: "Port invalide (1024–65535)" };
  writePort(p);
  serverPort = p;
  return { ok: true };
});

ipcMain.handle("restart-server", () => {
  if (serverProcess) serverProcess.kill();
  setTimeout(() => {
    startServer();
    sendStatus();
  }, 800);
});

ipcMain.handle("hide", () => {
  mainWindow.hide();
});

ipcMain.handle("quit", () => {
  if (serverProcess) serverProcess.kill();
  app.exit(0);
});
