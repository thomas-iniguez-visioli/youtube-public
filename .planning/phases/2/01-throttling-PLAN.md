---
phase: 2-resource-management
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [src/index.js]
autonomous: true
requirements: [STAB-02]
must_haves:
  truths:
    - "Concurrent yt-dlp processes are limited to a fixed number (e.g., 2)"
  artifacts:
    - path: "src/index.js"
      provides: "Concurrency-limited DownloadQueue"
  key_links:
    - from: "src/index.js"
      to: "yt-dlp spawn"
      via: "DownloadQueue.add()"
---

<objective>
Implement a request and process throttling system to prevent system resource exhaustion.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Implement DownloadQueue Class</name>
  <files>src/index.js</files>
  <action>
    Create a simple `DownloadQueue` class in `src/index.js` to manage a queue of functions with a concurrency limit.
    Default limit should be 2 concurrent downloads.
  </action>
  <verify>Check logs to ensure no more than 2 downloads run simultaneously when multiple are added.</verify>
  <done>Downloads are processed sequentially or with limited concurrency.</done>
</task>

<task type="auto">
  <name>Task 2: Wrap Download Calls in Queue</name>
  <files>src/index.js</files>
  <action>
    Modify `downloaddata` and `downloadbacklog` to use the new `DownloadQueue`.
    Ensure metadata fetching is also throttled if it spawns a process.
  </action>
  <verify>Add 5 videos to backlog and verify they are processed according to the concurrency limit.</verify>
  <done>All yt-dlp spawns are governed by the queue.</done>
</task>

</tasks>

<success_criteria>
Application no longer crashes with ERR_INSUFFICIENT_RESOURCES during heavy download sessions.
</success_criteria>
