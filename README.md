<div align="center">
  <a href="https://github.com/Aeroduel">
    <img src="public/two-jets-logo.svg" alt="Aeroduel Logo" width="800" />
  </a>
  <br />
  <hr/>
  <br />
  <img src="public/logo_text.svg" alt="Aeroduel" width="400" />
  <br />
  <img src="public/server-text.svg" alt="Server" width="150" />
  <br />
  <h1>Aeroduel Local Server</h1>
  <p>
    <strong>The dedicated game server for the Aeroduel experience.</strong>
  </p>
</div>

---

Note: [Click Here](#prerequisites) to skip to prerequisites and installation.

## About The Project

**Aeroduel Server** is a desktop application that acts as a local match server. It allows users to host Aeroduel matches
on their local network with a single click.

Designed to pair with the Aeroduel mobile app, this server handles all game logic, state management, and real-time
communication with the RC planes. Meanwhile, the mobile app allow pilots to register their plane for the match, view
live scores, and more.

### How it Works

1. **Host:** One user runs this desktop app. Simply click "New Match" to create a match on the local server.
2. **Connect:** Players connect their phones to the same WiFi network the computer is on. This can be a standard Wi-Fi
   network or a mobile hotspot.
3. **Play:** Players scan a QR code or enter a Game PIN to register their plan for the dogfight match.

## Tech Stack

- **Runtime:** [Electron](https://www.electronjs.org/)
- **Framework:** [Next.js](https://nextjs.org/) + [React](https://reactjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Packaging:** [Electron Builder](https://www.electron.build/)

## Getting Started

### Prerequisites

* npm\*
* Node.js\* (v22 or higher recommended) (included with npm)
* Bonjour (or an equivalent mDNS responder) if running on **Windows**
* Avahi (or an equivalent mDNS responder) if running on **Linux** (if not already installed by default)
* WiFi or mobile hotspot  
<small>*: required only if building from source</small>

### mDNS Responders for Windows

If you have one of these installed, you can probably skip this:
- Bonjour Print Services
- iTunes
- iCloud for Windows  

This is a non-exhaustive list.

### Download the Latest Release

While we do not have a complete product yet, you can download our latest
development snapshot from the **[releases page](https://github.com/Aeroduel/server/releases)**.

### Installation from Source

> Note: It would be easier to download our **[pre-built GitHub releases](https://github.com/Aeroduel/server/releases)**.
Additionally, it is not guaranteed that building from the latest source code 
will always build a stable version.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Aeroduel/server.git
   cd server
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

### Building the Application

To create a distributable desktop application (AppImage, dmg, exe), you must 
first build the Next.js application in standalone mode, and then package it 
with Electron. We've made this simple for you and combined them into one step
with a script.

**Build Next.js source and package the application:**
```bash
npm run build
```
The output will be located in the `dist` directory.  
> *Note: On Windows and MacOS, an installer will be built. You will have to run this to 
install the real application. The Linux version does not require this step.*

### Running the Application
Navigate to the `dist` directory and run the executable. The executable will 
have a different file extension depending on your operating system.

#### Windows
`aeroduel_server-<version code>.nsis`
#### MacOS
`aeroduel_server-<version code>.dmg`
#### Linux
`aeroduel_server-<version code>.AppImage`  
<small>I use arch btw</small>

## Features

* **Automatic Server Hosting:** Zero configuration required. The app automatically hosts a server on the local 
  network at http://aeroduel.local:45045.
* **Local Network Access:** The server exposes an API that can be accessed from any device connected
  to the local network interface. This API is protected by auth tokens so that endpoints can only be used by the 
  devices that need to access them.
* **Real-time Communication with RC Planes:** Using WebSockets or similar, the server maintains low-latency
  communication with the RC planes during each match to keep live score and run game logic.
* **Hybrid Architecture:** leverages Next.js "Standalone" mode to bundle a full Node.js server inside a desktop
  executable.
* **Amazing UI:** Handmade UI elements and animations to create a modern and sleek experience while keeping the UI
  simple and intuitive.
* **Open Source:** Built with open source technologies like Next.js, Electron, and Tailwind CSS, well documented, 
  and fully open source. Fork the project and customize it to your heart's content!

## Testing & Simulators

While there are no unit tests for this repository ***yet***, there are simulator GUIs to test the ESP32's
and mobile app's endpoints. 

### ESP32 Simulator
You can find this repository [here](https://github.com/Zytronium/aeroduel_arduino_simulator).

### Mobile Simulator
You can find this repository [here](https://github.com/Zytronium/aeroduel_mobile_simulator).

## Modding & Open Source

We built Aeroduel to be hacked on. The game logic resides entirely within this backend application. This means 
developers can fork this repository to customize the game experience. Anything from tweaked game logic to full-on
custom game modes can be built with the right skill set and experience. Add AI to the mix, and you don't even have
to know how to code to make modifications!

We encourage the community to fork, modify, and play around with the code! Our only requirement is that you adhere 
to the MIT license and provide attribution for this project if you decide to use it in a public project — commercially
or otherwise.

## Known issues
Besides the fact that the application is incomplete, there are a few known issues.

- Some phones, including some or all Android 13 phones, do not support using mDNS to connect to aeroduel.local:45045. 
  This may affect the mobile app's ability to work on some devices. We are unsure if this is something we can fix on our end.
  - Possible workaround we can implement: Buy aeroduel.com (or similar) and send the game PIN to an API running on it. 
    This would also allow for players to not need to be on the same Wi-Fi network anymore. 
- `aeroduel.local` unregisters after some time (5–15 minutes) when running in Electron, but only temporarily. This is a major issue that needs to be fixed.
  - ```
    aeroduel.local:45045/api/hit:1
    Failed to load resource: net::ERR_NAME_NOT_RESOLVED
    ```
- Match state does not reset when a new match is created
- Plane icons in background stretch as page gets taller due to increased event logs in the ongoing match page.
- Matches can start with fewer than two players joined

## Project Structure

```
aeroduel_backend/
├── electron/          # Electron main process & preload script
├── public/            # Static assets (Images, fonts, etc.)
├── src/               # Next.js source code (React UI & API)
├── next.config.ts     # Next.js configuration (Standalone mode enabled)
└── package.json       # Dependencies & Build configuration
```

## Roadmap

- [x] **Core Server Architecture:** Next.js running inside Electron.
- [x] **Production Packaging:** Native binaries for Linux/Windows/Mac.
- [X] **Local Server Hosting:** Next.js API available via LAN at `aeroduel.local:45045` at all times.
- [X] **Plane Registration/Linking** Let users register their planes and link the physical plane's software with the
  local server during a match.
- [X] **Game Logic Implementation:** Hit processing and score tracking.
- [ ] **Complete API:** API endpoints for everything required for the game, from linking planes and starting matches to registering hits and disqualifying planes.
- [ ] **WebSocket Integration:** WebSocket implementation to keep mobile app updated with live scores and game state and send commands to planes.

## License

Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

## Authors

### Backend Team

["Zytronium"](https://github.com/Zytronium)

### Aeroduel Team

- [Malik Vance](https://github.com/SpaceDandy15)
- ["Zytronium"](https://github.com/Zytronium)
- [Tristan Davis](https://github.com/TebariousBag)
- [Zack Yuan](https://github.com/zack6yuan)
