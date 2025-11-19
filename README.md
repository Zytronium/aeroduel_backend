<div align="center">
  <img src="public/two-jets-logo.svg" alt="Aeroduel Logo" width="800" />
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

## About The Project

**Aeroduel Server** is a desktop application that acts as a local match server. It allows users to host Aeroduel matches on their local network with a single click.

Designed to pair with the Aeroduel mobile app, this server handles all game logic, state management, and real-time communication with the RC planes. Meanwhile, the mobile app allow pilots to register their plane for the match, view live scores, and more.

### How it Works
1. **Host:** One user runs this desktop app. Simply click "Start Match" to open a local server.
2. **Connect:** Players connect their phones to the same WiFi network the computer is on. This can be a standard WiFi network or a mobile hotspot.
3. **Play:** Players scan a QR code or enter a Game PIN to register their plan for the dogfight match.

## Tech Stack
-   **Runtime:** [Electron](https://www.electronjs.org/)
-   **Framework:** [Next.js](https://nextjs.org/) + [React](https://reactjs.org/)
-   **Language:** [TypeScript](https://www.typescriptlang.org/)
-   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
-   **Packaging:** [Electron Builder](https://www.electron.build/)

## Getting Started

### Prerequisites
*   Node.js (v22 or higher recommended)
*   npm

### Installation
1.  **Clone the repository:**
    ```bash
    git clone https://github.com/zytronium/aeroduel_backend.git
    cd aeroduel_backend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run in Development Mode:**
    This runs the Next.js development server inside the Electron shell.
    ```bash
    npm run dev
    ```

### Building for Production

To create a distributable desktop application (AppImage, dmg, exe), you must first build the Next.js application in "standalone" mode, and then package it with Electron.

1.  **Build Next.js source:**
    ```bash
    npm run build
    ```

2.  **Package the Application:**
    ```bash
    npx electron-builder
    ```
    *Note: The output will be located in the `dist` directory.*

## Features
*   **One-Click Hosting (coming soon):** Zero configuration required. The app automatically finds an open port and binds to the local network interface.
*   **Hybrid Architecture:** leverages Next.js "Standalone" mode to bundle a full Node.js server inside a desktop executable.
*   **Amazing UI:** Handmade UI elements and animations to create a modern and sleek experience while keeping the UI simple and intuitive.
*   **Open Source:** Built with open source technologies like Next.js, Electron, and Tailwind CSS. Fork the project and customize it to your heart's content!

## Modding & Open Source
We built Aeroduel to be hacked on. The game logic resides entirely within this backend application. This means developers can fork this repository to customize the game experience. Anything from tweaked game logic to full-on custom game modes can be built with the right skill set and experience. Add AI to the mix, and you don't even have to know how to code to make modifications!

We encourage the community to fork, modify, and play around with the code!

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
- [ ] **Local Server Hosting:** Next.js API triggered from a single click in the frontend.
- [ ] **Game Logic Implementation:** Hit processing and score tracking.
- [ ] **Mobile Integration:** WebSocket implementation for phone controllers.
- [ ] **Database Integration:** MongoDB/PostgreSQL for match state.

## License
Distributed under the MIT License. See [LICENSE](LICENSE) for more information.

## Authors

### Backend Team
-   ["Zytronium"](https://github.com/Zytronium)
-   [](https://github.com/Aeroduel)

### [Aeroduel](https://github.com/Aeroduel) Team
-   [Malik Vance](https://github.com/Aeroduel)
-   ["Zytronium"](https://github.com/Zytronium)
-   [Tristan Davis](https://github.com/Aeroduel)
-   [Zack Yuan](https://github.com/Aeroduel)
-   [Frandy Slueue](https://github.com/Aeroduel)

[//]: # (TODO: Add team members github links)
