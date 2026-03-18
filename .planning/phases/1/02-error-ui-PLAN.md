---
phase: 1-foundation-stability
plan: 02
type: execute
wave: 2
depends_on: ["1-01"]
files_modified: [src/index.js, src/renderer.js, src/views/index.ejs]
autonomous: true
requirements: [STAB-03]
must_haves:
  truths:
    - "Errors during binary execution are shown in the UI"
  artifacts:
    - path: "src/renderer.js"
      contains: "socket.on('error-notification')"
---

<objective>
Bridge backend error logs to the frontend UI to ensure users are notified of process failures.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Emit Errors via Socket.io</name>
  <files>src/index.js</files>
  <action>
    Update the `setupElectronLogForwarding` or download catch blocks to emit an 'error-notification' event via `io` (Socket.io).
    Include the error message and a user-friendly suggestion (e.g., "Check internet connection" or "Binary missing").
  </action>
  <verify>Trigger a fake error in index.js and check if it is emitted to the socket.</verify>
  <done>Backend errors are dispatched to connected clients.</done>
</task>

<task type="auto">
  <name>Task 2: Implement UI Notifications</name>
  <files>src/renderer.js, src/views/index.ejs</files>
  <action>
    Add a listener in `renderer.js` for 'error-notification'.
    Use a simple alert or append a notification element to the UI to display the error.
  </action>
  <verify>Manual check: disconnect internet or rename a binary to trigger an error and see it in the UI.</verify>
  <done>Users see a clear notification when a download process fails due to binary or environment issues.</done>
</task>

</tasks>

<success_criteria>
Critical process errors are visible to the user without checking log files.
</success_criteria>
