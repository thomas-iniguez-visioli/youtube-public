# Phase 2 Research: Resource Management

## Current Resource Usage
- **Process Spawning**: The app spawns `yt-dlp` for metadata and downloads without any concurrency control. This leads to `ERR_INSUFFICIENT_RESOURCES` when multiple downloads are started.
- **Memory Management**: An `optimizeMemory` function exists but is called on a fixed interval (10 mins) and after downloads. It might not be aggressive enough for high-usage sessions.
- **Data Handling**: EJS templates render the entire library at once, which can be slow and memory-intensive as the library grows.

## Issues Identified
1. **Parallel Downloads**: No limit on concurrent `yt-dlp` processes.
2. **Socket Exhaustion**: Rapid sequential requests can exhaust available ports.
3. **Memory Leaks**: Potential leaks in long-running processes or unhandled stream buffers.

## Proposed Solutions
1. **Queue System**: Implement a concurrency-limited queue (e.g., using `p-queue` or a simple custom semaphore) for all `yt-dlp` calls.
2. **Aggressive Memory Optimization**: Trigger `optimizeMemory` more strategically and include manual `global.gc()` calls if the app is started with `--expose-gc`.
3. **UI Efficiency**: Implement simple pagination or "Load More" for the library view to reduce DOM size and rendering time.

## Conclusion
The implementation will focus on a `DownloadQueue` class and enhancing the existing `optimizeMemory` utility.
