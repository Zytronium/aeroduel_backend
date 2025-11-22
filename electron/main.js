// Note: requires `bonjour-service` in packaged app/environment.

const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");
const fs = require("fs");
const os = require("os");

// Load bonjour-service, but be resilient to packaging / alternate package
let BonjourModule = null;
try {
  BonjourModule = require("bonjour-service");
} catch (e1) {
  // fallback to 'bonjour' if bonjour-service not present at runtime
  try {
    BonjourModule = require("bonjour");
  } catch (e2) {
    BonjourModule = null;
  }
}

let serverProcess;
let win;
let bonjour;
let publishedService;

function getLocalIp() {
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) {
    for (const iface of ifs[name]) {
      // Must be IPv4, not internal, and not link-local
      if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("169.254.")) {
        return iface.address;
      }
    }
  }
  return null;
}

async function createWindow() {
  const port = process.env.PORT || 45045;
  const isDev = !app.isPackaged;

  const iconPath = isDev
    ? path.join(__dirname, "..", "public", "logo.png")
    : path.join(process.resourcesPath, "standalone", "public", "logo.png");

  win = new BrowserWindow({
    width: 1200,
    height: 900,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true
    }
  });

  // Only open dev tools in development mode
  if (isDev) {
    win.webContents.openDevTools({ mode: "detach" });
  }

  const runtimeNode = isDev ? "node" : process.execPath;

  // Path to server.js
  let serverPath;
  if (isDev) {
    serverPath = path.join(__dirname, "..", ".next", "standalone", "server.js");
  } else {
    // In production, use the extraResources directory
    serverPath = path.join(
      process.resourcesPath,
      "standalone",
      "server.js"
    );
  }

  console.log("Electron starting...");
  console.log("Server path:", serverPath);
  console.log("Port selected:", port);

  if (!fs.existsSync(serverPath)) {
    console.error("ERROR: server.js not found at:", serverPath);
    win.loadURL("data:text/html,<h1>Server not found!</h1>");
    return;
  }

  const localIp = getLocalIp();
  console.log("Detected local IPv4:", localIp || "none");

  // Spawn Next.js standalone server bound to 0.0.0.0 (all interfaces)
  serverProcess = spawn(runtimeNode, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      PORT: String(port),
      HOSTNAME: "0.0.0.0", // Next.js standalone uses HOSTNAME not HOST
      // Ensure Electron binary behaves like Node when executing the script in prod
      ...(!isDev && { ELECTRON_RUN_AS_NODE: "1" })
    },
    stdio: "pipe"
  });

  let detectedHost = null;

  serverProcess.stdout.on("data", (d) => {
    const output = d.toString();
    console.log("[server stdout]", output);

    // Try to extract host from Next.js output: "- Local: http://HOST:PORT"
    const match = output.match(/Local:\s+https?:\/\/([^/:]+)(?::\d+)?/i);
    if (match && match[1] && !detectedHost) {
      detectedHost = match[1];
      console.log("Detected server host:", detectedHost);
    }
  });

  serverProcess.stderr.on("data", (d) => {
    console.error("[server stderr]", d.toString());
  });

  serverProcess.on("exit", (code, signal) => {
    console.log(`[server exited] code: ${code}, signal: ${signal}`);
    serverProcess = null;
    // Unpublish mDNS if published
    try {
      if (publishedService && typeof publishedService.stop === "function") {
        publishedService.stop();
        publishedService = null;
      }
      if (bonjour && typeof bonjour.destroy === "function") {
        bonjour.destroy();
        bonjour = null;
      }
    } catch (e) {
      console.error("Error stopping bonjour:", e);
    }
    if (win) win.loadURL("data:text/html,<h1>Server exited!</h1>");
  });

  // Wait for server to print its host, then load
  setTimeout(() => {
    const hostToUse = detectedHost || localIp || "127.0.0.1";
    console.log("Loading app URL: http://" + hostToUse + ":" + port);
    win.loadURL(`http://${hostToUse}:${port}`);

    // Publish mDNS after loading
    publishMDNS(localIp, port, isDev);
  }, 2000);
}

function publishMDNS(localIp, port, isDev) {
  if (!localIp) {
    console.warn("No valid local IPv4 found. mDNS will not be published.");
    return;
  }

  if (!BonjourModule) {
    console.warn("No mDNS library available. mDNS will not be published.");
    return;
  }

  try {
    // Instantiate bonjour
    if (typeof BonjourModule === "function") {
      try { bonjour = new BonjourModule(); } catch (e) { bonjour = BonjourModule(); }
    } else if (BonjourModule && typeof BonjourModule.default === "function") {
      try { bonjour = new BonjourModule.default(); } catch (e) { bonjour = BonjourModule.default(); }
    } else {
      bonjour = BonjourModule();
    }

    if (!bonjour || typeof bonjour.publish !== "function") {
      console.error("bonjour instance does not support publish()");
      return;
    }

    // Publish custom AeroDuel service
    try {
      bonjour.publish({
        name: "AeroDuel Server",
        type: "aeroduel",
        port: Number(port),
        host: localIp,
        txt: { path: "/", version: isDev ? "dev" : "prod" }
      });
    } catch (e) {
      console.warn("Publishing custom aeroduel service failed:", e);
    }

    // Publish HTTP service as aeroduel.local
    try {
      publishedService = bonjour.publish({
        name: "aeroduel",
        type: "http",
        port: Number(port),
        host: localIp,
        txt: { path: "/", version: isDev ? "dev" : "prod" }
      });
      console.log(`Published mDNS: aeroduel.local -> ${localIp}:${port}`);
    } catch (e) {
      console.warn("Publishing HTTP aeroduel hostname failed:", e);
    }
  } catch (err) {
    console.error("Failed to publish mDNS service:", err);
  }
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  // cleanup bonjour
  try {
    if (publishedService && typeof publishedService.stop === "function") {
      publishedService.stop();
      publishedService = null;
    }
    if (bonjour && typeof bonjour.destroy === "function") {
      bonjour.destroy();
      bonjour = null;
    }
  } catch (e) {
    console.error("Error stopping bonjour:", e);
  }
  app.quit();
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  if (win) win.webContents.openDevTools({ mode: "detach" });
});
