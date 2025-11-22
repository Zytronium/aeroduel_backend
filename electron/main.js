// Note: requires `multicast-dns` package for cross-platform mDNS A record publishing

const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");
const fs = require("fs");
const os = require("os");

let serverProcess;
let win;
let mdnsResponder;

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

  try {
    // Use multicast-dns for cross-platform A record publishing
    const mdns = require("multicast-dns")({
      reuseAddr: true,
      loopback: true
    });

    // Respond to queries for aeroduel.local with our IP (A record)
    mdns.on("query", (query) => {
      const aeroQuery = query.questions.find(
        q => q.name === "aeroduel.local" && (q.type === "A" || q.type === "ANY")
      );

      if (aeroQuery) {
        console.log("Responding to mDNS A record query for aeroduel.local");
        mdns.respond({
          answers: [{
            name: "aeroduel.local",
            type: "A",
            ttl: 300,
            data: localIp
          }]
        });
      }

      // ALSO respond to service discovery queries for _aeroduel._tcp.local
      const serviceQuery = query.questions.find(
        q => (q.name === "_aeroduel._tcp.local" || q.name === "_services._dns-sd._udp.local")
          && (q.type === "PTR" || q.type === "ANY")
      );

      if (serviceQuery) {
        console.log("Responding to mDNS service discovery query");
        const serviceName = `AeroDuel Server._aeroduel._tcp.local`;

        mdns.respond({
          answers: [
            {
              name: "_aeroduel._tcp.local",
              type: "PTR",
              ttl: 300,
              data: serviceName
            }
          ],
          additionals: [
            {
              name: serviceName,
              type: "SRV",
              ttl: 300,
              data: {
                priority: 0,
                weight: 0,
                port: port,
                target: "aeroduel.local"
              }
            },
            {
              name: "aeroduel.local",
              type: "A",
              ttl: 300,
              data: localIp
            },
            {
              name: serviceName,
              type: "TXT",
              ttl: 300,
              data: Buffer.from(`version=${isDev ? "dev" : "prod"}`)
            }
          ]
        });
      }
    });

    // Proactively announce our service on startup
    const announceService = () => {
      const serviceName = `AeroDuel Server._aeroduel._tcp.local`;
      mdns.respond({
        answers: [
          {
            name: "_aeroduel._tcp.local",
            type: "PTR",
            ttl: 300,
            data: serviceName
          },
          {
            name: serviceName,
            type: "SRV",
            ttl: 300,
            data: {
              priority: 0,
              weight: 0,
              port: port,
              target: "aeroduel.local"
            }
          },
          {
            name: "aeroduel.local",
            type: "A",
            ttl: 300,
            data: localIp
          }
        ]
      });
    };

    // Announce immediately and every 60 seconds
    announceService();
    const announceInterval = setInterval(announceService, 60000);

    mdns.on("error", (err) => {
      console.error("mDNS error:", err);
    });

    mdnsResponder = { mdns, announceInterval };
    console.log(`mDNS responder active: aeroduel.local -> ${localIp}:${port}`);
    console.log(`Service published: _aeroduel._tcp.local`);
    console.log(`ESP32/mobile apps can discover this service`);

  } catch (err) {
    console.error("Failed to setup mDNS responder:", err);
    console.error("Install multicast-dns: npm install multicast-dns");
  }
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (mdnsResponder) {
    try {
      if (mdnsResponder.announceInterval) {
        clearInterval(mdnsResponder.announceInterval);
      }
      if (mdnsResponder.mdns) {
        mdnsResponder.mdns.destroy();
      }
    } catch (e) {
      console.error("Error stopping mdns responder:", e);
    }
  }
  app.quit();
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  if (win) win.webContents.openDevTools({ mode: "detach" });
});