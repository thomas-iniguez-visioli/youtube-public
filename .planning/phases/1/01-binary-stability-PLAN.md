---
phase: 1-foundation-stability
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/binaryResolver.js, src/index.js, src/downloader.js]
autonomous: true
requirements: [STAB-01]
must_haves:
  truths:
    - "Application finds binaries in AppData or system PATH automatically"
    - "yt-dlp explicitly knows the location of ffmpeg"
  artifacts:
    - path: "src/binaryResolver.js"
      provides: "Centralized path resolution and validation"
  key_links:
    - from: "src/index.js"
      to: "src/binaryResolver.js"
      via: "require"
---

<objective>
Centralize binary path resolution and implement pre-flight validation checks to ensure yt-dlp, ffmpeg, and bun are functional before operations begin.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Create BinaryResolver Module</name>
  <files>src/binaryResolver.js</files>
  <action>
    Create a new module that exports an object with paths for 'ytdlp', 'ffmpeg', and 'bun'.
    Logic should:
    1. Check app.getPath('userData')
    2. Check process.resourcesPath (Electron resources)
    3. Fallback to system PATH using 'which' or 'where' equivalent.
    Include a `validateBinaries()` function that spawns each with `--version` to confirm they work.
  </action>
  <verify>Run a node script that imports BinaryResolver and logs the resolved paths and validation status.</verify>
  <done>All three binaries are correctly located and validated on the dev machine.</done>
</task>

<task type="auto">
  <name>Task 2: Refactor Path Logic in Core Files</name>
  <files>src/index.js, src/downloader.js</files>
  <action>
    Replace all inline `path.join(app.getPath('userData'), ...)` logic for binaries with calls to `binaryResolver`.
    Update `createDownloadArgs` in `downloader.js` to ensure `--ffmpeg-location` always uses the absolute path from the resolver.
  </action>
  <verify>Start the app and verify logs show the resolver-provided paths being used.</verify>
  <done>No hardcoded binary paths remain in index.js or downloader.js.</done>
</task>

</tasks>

<success_criteria>
Binaries are resolved through a single source of truth and validated on startup.
</success_criteria>
