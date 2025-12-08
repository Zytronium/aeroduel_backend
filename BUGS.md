# Aeroduel Server Bugs
The bug tracker for the Aeroduel Server.

[//]: # (Because I was too lazy to make GitHub issues for all these bugs)

## Known Bugs

### Server either does not build or does not load CSS on MacOS

#### Possible Causes
- Unknown

#### Possible Fixes and Workarounds
- None yet.

#### Troubleshooting Options
- Turn your device off and back on again.
- Try in docker if MacOS is available in docker.

---

### Plane icons in UI are based on position in list rather than ID

#### Cause
- Plane icons are based on position in list rather than ID.
  - This causes icons to not stay consistent when planes moved around in the list and causes icons in "Joined Planes" to sometimes not match icons in "Online Planes."

#### Fixes
- Assign an icon (black plane or white plane) to each plane in the list when it goes online.
  - Note: This can cause all planes in a match to have the same icon if every other online plane joins the match. Consider creating more color variants. 

---

### `timeRemaining` Attribute of Match State in WebSocket `match:update` is Always Null
![Image from mobile simulator](/markdown%20assets/timeRemainingNull.png)

### Possible Causes
- Unknown

### Possible Fixes and Workarounds
- Remove timeRemaining from match:update as it's probably not needed.
- Find out why it's null and give it a value.


## Future Bugs
<small>AI autocomplete generated this, and I figured I'd have some fun with it.</small>

- Server crashes when a player leaves a match
- Server crashes when a player joins a match
- Server crashes when a plane hits the ground
- Tux the penguin takes players' heads off
- Server crashes when a player is kicked from a match
