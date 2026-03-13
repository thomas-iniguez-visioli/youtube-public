# Phase 1 Research: Foundation Stability

## Current Path Resolution
- **yt-dlp**: Located at `userData/ytdlp.exe` (Windows) or `userData/ytdlp`.
- **ffmpeg**: Located at `userData/ffmpeg.exe`.
- **bun**: Located at `userData/bun.exe`.

The application adds the `userData` directory to the `Path` environment variable before spawning processes.

## Issues Identified
1. **Implicit Dependencies**: `yt-dlp` might fail if `ffmpeg` is not in the system path or explicitly provided.
2. **Environment Variability**: `app.getPath('userData')` varies between environments (e.g., standard install vs. portable).
3. **Silent Failures**: Errors from `child.spawn` are logged but not always surfaced to the UI in a helpful way.
4. **Binary Updates**: The app tries to update binaries on startup if a new version is detected, but this can be interrupted or fail.

## Proposed Improvements
1. **Path Fallbacks**: Check `userData`, then the application's own directory (`process.resourcesPath` for Electron), and finally the system `PATH`.
2. **Explicit Paths**: Always provide the absolute path to `ffmpeg` to `yt-dlp` using `--ffmpeg-location`.
3. **Process Validation**: Before attempting a download, run a lightweight check (e.g., `--version`) for each required binary.
4. **Enhanced UI Notifications**: Bridge the `log` events to the frontend via Socket.io to inform the user of specific failures (e.g., "yt-dlp missing", "Access denied to AppData").

## Technical Debt
- `src/index.js` contains a lot of setup logic that could be modularized.
- Binary downloading and unzipping logic is inline and lacks retry mechanisms.

## Conclusion
The plan should focus on creating a `BinaryResolver` module to centralize path logic and adding a "Pre-flight check" before downloads.
