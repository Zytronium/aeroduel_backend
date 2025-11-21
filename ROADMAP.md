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
  <h1>Aeroduel Server Roadmap</h1>
</div>

---

## Completed

### Core Server Architecture
Get Next.js running inside Electron. The desktop application must run its own server locally and allow use of APIs in 
the future. It must be able to host a server on the local network and support web sockets with other devices.

### Production Packaging
Package native binaries for Linux/Windows/Mac.  
Note: So far only tested on Linux (Fedora and Zorin OS)

### Basic frontend for desktop app UI
Use Next.js and React to build a basic desktop UI with a single button to start a match on the local network. 

## In Progress

### Local Server Hosting
Next.js API triggered from a single click in the frontend.

### Database Integration
~~MongoDB/PostgreSQL or local database for match state~~. Store game state in memory. Include API endpoints to 
read data but do not allow clients to write, not even when joining matches (the server will handle that if the 
endpoint for joining a match does not fail).

### Documentation
Write up a detailed markdown API.md for the server endpoints. This helps other developers understand the server
when forking and editing the code, perhaps even to use the API in their own projects.

## Todo

### RC Plane Registration/Linking
Users will be able to register their plane with the mobile app. The mobile app will assign a unique ID to that plane and 
associate it with its user as the pilot. We need to figure out how we are going to link the physical plane to that ID so
the server knows which planes are in the match. We also need to decide whether planes will be registered globally or
only locally on the users' devices. It would be easiest to register only locally, but then it would be possile for 
plane IDs to overlap. 

### Game Logic Implementation
Hit processing and score tracking. When a plane locks on to the target, it sends a signal to the server confirming a hit.
The server then updates the score and sends web socket updates to all connected mobile devices.

### Mobile Integration
WebSocket implementation for phone controllers.

---

## Next steps

- Add endpoint for joining a match
- Add endpoint for starting a match
- Add endpoint for ending a match (?)
- Make the front-end create a new match on click of the button via API call
- Make the front-end display a game pin and generate a QR code for the match
- Create a WebSocket server
- Consider protecting the API endpoints with authentication
- Add CI/CD
- Add unittesting
- 