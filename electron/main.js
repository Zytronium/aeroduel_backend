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
      if (iface.family === "IPv4" && !iface.internal) {
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

  // Spawn Next.js standalone server bound to all interfaces so it's reachable from LAN.
  serverProcess = spawn(runtimeNode, [serverPath], {
    cwd: path.dirname(serverPath),
    env: { 
      ...process.env, 
      PORT: String(port),
      HOST: "0.0.0.0",
      // Ensure Electron binary behaves like Node when executing the script in prod
      ...(!isDev && { ELECTRON_RUN_AS_NODE: "1" })
    },
    stdio: "pipe"
  });

  serverProcess.stdout.on("data", (d) => {
    console.log("[server stdout]", d.toString());
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

  // Wait a bit for server to accept connections on loopback and local IP, then load URL and publish mDNS.
// Wait a bit for server to accept connections on loopback and local IP, then load URL and publish mDNS.
  const waitForServer = async () => {
    const maxRetries = 40;
    let retries = 0;
    const delay = (ms) => new Promise(r => setTimeout(r, ms));
    const localIp = getLocalIp();

    // Try to extract the host from server stdout (Next prints "Local: http://<host>:<port>" and "Network: ...")
    let stdoutHost = null;
    const stdoutBuf = [];
    const stdoutListener = (d) => {
      try {
        const s = d.toString();
        stdoutBuf.push(s);
        // Try to match `Local:         http://<host>:<port>` or `- Local:         http://<host>:<port>`
        const m = s.match(/Local:\s+https?:\/\/([^/:]+)(?::\d+)?/i) || s.match(/Local:\s+http:\/\/([^/:]+)(?::\d+)?/i);
        if (m && m[1]) stdoutHost = m[1];
        // Also check for Network line if Local not present
        const n = s.match(/Network:\s+https?:\/\/([^/:]+)(?::\d+)?/i) || s.match(/Network:\s+http:\/\/([^/:]+)(?::\d+)?/i);
        if (!stdoutHost && n && n[1]) stdoutHost = n[1];
      } catch (e) {
        // ignore parse errors
      }
    };

    serverProcess.stdout.on("data", stdoutListener);

    // Hosts to prefer probing (loopback first, then local IP if present)
    const hostsToTry = ["127.0.0.1"];
    if (localIp && localIp !== "127.0.0.1") hostsToTry.push(localIp);

    // Attempt network probes until a host responds or stdout yields a host
    let successfulHost = null;
    while (retries < maxRetries && !successfulHost) {
      // If stdout exposed a host (Next is ready), prefer it
      if (stdoutHost) {
        // If stdoutHost is the machine name (e.g. "fedora"), try resolving it to an IP by probing directly
        try {
          await new Promise((resolve, reject) => {
            const client = net.createConnection({ port, host: stdoutHost, timeout: 500 }, () => {
              client.end();
              resolve();
            });
            client.on("error", reject);
            client.on("timeout", () => {
              client.destroy();
              reject(new Error("timeout"));
            });
          });
          successfulHost = stdoutHost;
          break;
        } catch {
          // stdoutHost didn't respond directly; continue probing other hosts
        }
      }

      // Probe hostsToTry sequentially
      for (const host of hostsToTry) {
        try {
          await new Promise((resolve, reject) => {
            const client = net.createConnection({ port, host, timeout: 500 }, () => {
              client.end();
              resolve();
            });
            client.on("error", reject);
            client.on("timeout", () => {
              client.destroy();
              reject(new Error("timeout"));
            });
          });
          successfulHost = host;
          break;
        } catch (_) {
          // try next host
        }
      }

      if (!successfulHost) {
        await delay(250);
        retries++;
      }
    }

    // Clean up stdout listener
    try { serverProcess.stdout.removeListener("data", stdoutListener); } catch (e) {}

    // If nothing responded, but stdoutHost exists, load it anyway (useful when numeric IP probing fails)
    const hostToLoad = successfulHost || stdoutHost || "127.0.0.1";
    console.log("Loading app URL: http://" + hostToLoad + ":" + port);
    win.loadURL(`http://${hostToLoad}:${port}`);

// Publish mDNS service so devices can resolve aeroduel.local -> this host:port
    try {
      const publishLocalIpCandidate = successfulHost || localIp || stdoutHost || "127.0.0.1";

      // Prefer numeric IP; if we have a non-numeric hostname, try to resolve it to an IP.
      let publishIp = publishLocalIpCandidate;
      const isNumericIp = (h) => /^\d+\.\d+\.\d+\.\d+$/.test(h);

      if (!isNumericIp(publishIp)) {
        // try to resolve hostname to numeric IP
        try {
          const dns = require("dns").promises;
          const lookup = await dns.lookup(publishIp);
          if (lookup && lookup.address) publishIp = lookup.address;
        } catch (e) {
          // resolution failed — fall back to getLocalIp() or loopback
          publishIp = localIp || "127.0.0.1";
        }
      }

      if (!BonjourModule) {
        console.warn("No mDNS library available (bonjour-service or bonjour). mDNS will not be published.");
        if (app.isPackaged) {
          console.warn("If you intended to use bonjour-service, ensure it is listed in dependencies and added to asarUnpack in your build config.");
        }
        return;
      }

      // instantiate bonjour (constructor or factory)
      try {
        if (typeof BonjourModule === "function") {
          try { bonjour = new BonjourModule(); } catch (e) { bonjour = BonjourModule(); }
        } else if (BonjourModule && typeof BonjourModule.default === "function") {
          try { bonjour = new BonjourModule.default(); } catch (e) { bonjour = BonjourModule.default(); }
        } else {
          bonjour = BonjourModule();
        }
      } catch (err) {
        console.error("Failed to instantiate bonjour module:", err);
        throw err;
      }

      if (!bonjour || typeof bonjour.publish !== "function") {
        console.error("bonjour instance does not support publish(); mDNS will not be published.");
        return;
      }

      // 1) advertise the custom AeroDuel service (for device discovery)
      try {
        bonjour.publish({
          name: "AeroDuel Server",
          type: "aeroduel",
          port: Number(port),
          host: publishIp, // numeric IP ensures an A record target
          txt: { path: "/", version: isDev ? "dev" : "prod" }
        });
      } catch (e) {
        console.warn("Publishing custom aeroduel service failed:", e);
      }

      // 2) ALSO publish an HTTP service using the hostname `aeroduel` so that aeroduel.local resolves in browsers
      //    Use `name: "aeroduel"` so the local name becomes `aeroduel.local` and set host to the numeric IP.
      try {
        publishedService = bonjour.publish({
          name: "aeroduel",      // this will advertise aeroduel.local
          type: "http",
          port: Number(port),
          host: publishIp,       // numeric IP — publish the A record target
          txt: { path: "/", version: isDev ? "dev" : "prod" }
        });
      } catch (e) {
        console.warn("Publishing HTTP aeroduel hostname failed:", e);
      }

      console.log(`Published mDNS: aeroduel.local -> ${publishIp}:${port}`);
    } catch (err) {
      console.error("Failed to publish mDNS service:", err);
      if (app.isPackaged) {
        console.warn("If you're packaging the app, ensure the mDNS module is unpacked (asarUnpack) and present in dependencies.");
      }
    }

  };

  waitForServer();
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
