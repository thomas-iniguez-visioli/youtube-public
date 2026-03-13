# Roadmap

## Summary

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| **1: Foundation Stability** | Ensure reliable binary execution and robust error handling across environments. | STAB-01, STAB-03 | [Planned](phases/1/) |
| **2: Resource Management** | Implement request throttling and aggressive memory optimization for long sessions. | STAB-02, PERF-01 | [Planned](phases/2/) |
| **3: UI/UX Maturity** | Polish the interface and refine library discovery (search/filtering). | UIUX-01, UIUX-02 | Pending |

## Phases

### Phase 1: Foundation Stability
Goal: Ensure reliable binary execution and robust error handling across environments.
Plans:
- [01-binary-stability-PLAN.md](phases/1/01-binary-stability-PLAN.md)
- [02-error-ui-PLAN.md](phases/1/02-error-ui-PLAN.md)

Success Criteria:
1. Application successfully identifies `yt-dlp` and `ffmpeg` in `AppData` or fallback system paths.
2. Failed process spawns are caught and displayed as user-friendly notifications instead of silent failures.

### Phase 2: Resource Management
Goal: Implement request throttling and aggressive memory optimization for long sessions.
Plans:
- [01-throttling-PLAN.md](phases/2/01-throttling-PLAN.md)
- [02-memory-optimization-PLAN.md](phases/2/02-memory-optimization-PLAN.md)
Success Criteria:
1. Network requests to YouTube are limited to a configurable rate (e.g., max 1 request/sec).
2. Memory footprint is reduced via scheduled session cache clearing (improving on v1.1.52).

### Phase 3: UI/UX Maturity
Goal: Polish the interface and refine library discovery (search/filtering).
Success Criteria:
1. Search results update in real-time with fuzzy matching as the user types.
2. Navigation between playlists and history is fluid with clear active states.
