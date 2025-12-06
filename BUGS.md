# Aeroduel Server Bugs
The bug tracker for the Aeroduel Server.

[//]: # (Because I was too lazy to make GitHub issues for all these bugs)

## Known Bugs

### aeroduel.local unregisters for http requests after a few minutes.
- It sometimes re-registers after a long while
- WebSockets seem to work fine.

#### Possible Causes
- Unknown

#### Possible Fixes and Workarounds
- On the first http request to server the arduino and mobile app make, return local IP address in the response. Have them use this IP as a fallback when aeroduel.local fails to fetch.
- Put a similar API on api.aeroduel.com and have devices connect to that instead. This would also require game PINs and better security.

---

### Server either does not build or does not load CSS on MacOS

#### Possible Causes
- Unknown

#### Possible Fixes and Workarounds
- None yet.

#### Troubleshooting Options
- Turn your device off and back on again.
- Try in docker if MacOS is available in docker.

---

### Matches Can Begin With Less Than 2 Players Joined

#### Possible Causes
- I forgot to add a check for this.
- I added a check for this but it didn't work somehow.

#### Possible Fixes and Workarounds
- Add or fix the validation check in api/start-match 

---

### App Does Not Return to Main Page After Match Timer Ends

#### Possible Causes
- I forgot to implement this.

#### Possible Fixes and Workarounds
- Add like 3 lines of code to send the user to the root page when match timer ends in match-timer.ts

---

### Plane Icons in Background Stretch as Page Gets Taller Due to Increased Event Logs in the Ongoing Match Page.

#### Possible Causes
- Background CSS issues

#### Possible Fixes and Workarounds
- Add a scrollbar to match events bar
- Add a max-height to background plane images

---

### Match State Does Not Reset On New Match Creation
(partially fixed)

#### Possible Causes
- I forgot to make match state reset on match creation.
- I made match state reset on match creation but it didn't work somehow.

#### Possible Fixes and Workarounds
- Add a resetMatchState function to utils and call it in api/new-match or api/end-match

---

## Future Bugs
<small>AI autocomplete generated this, and I figured I'd have some fun with it.</small>

- Server crashes when a player leaves a match
- Server crashes when a player joins a match
- Server crashes when a plane hits the ground
- Tux the penguin takes players' heads off
- Server crashes when a player is kicked from a match
