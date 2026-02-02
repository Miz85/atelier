---
phase: 01-foundation
plan: 03
subsystem: infra
tags: [process-management, lifecycle, pty, cleanup, signals, node-pty, terminate]

# Dependency graph
requires:
  - phase: 01-01
    provides: TypeScript setup, node-pty and terminate dependencies
provides:
  - Process cleanup registry with tree kill capability
  - Comprehensive signal handlers (SIGINT, SIGTERM, SIGHUP, SIGQUIT)
  - Buffered PTY wrapper preventing data loss
  - Graceful shutdown infrastructure
affects: [all phases that spawn processes, terminal UI components, agent execution]

# Tech tracking
tech-stack:
  added: [terminate (process tree killer), node-pty integration]
  patterns: [global process registry singleton, buffered event streaming, graceful shutdown handlers]

key-files:
  created:
    - src/processes/cleanup.ts
    - src/processes/lifecycle.ts
    - src/processes/pty-manager.ts
  modified:
    - src/config/storage.ts

key-decisions:
  - "Global process registry singleton pattern for app-wide tracking"
  - "5-second timeout on cleanup to prevent hanging"
  - "Buffer all PTY data to handle race condition (VS Code pattern)"
  - "SIGTERM with SIGKILL fallback for stubborn processes"

patterns-established:
  - "Process registration: Register on spawn, unregister on exit"
  - "Signal handling: Call processRegistry.cleanup() on all signals"
  - "PTY usage: Always use BufferedPtyProcess, never raw node-pty"

# Metrics
duration: 3.1min
completed: 2026-02-02
---

# Phase 01 Plan 03: Process Lifecycle Management Summary

**Process registry with tree kill, comprehensive signal handlers, and buffered PTY manager preventing zombie processes and data loss**

## Performance

- **Duration:** 3.1 min
- **Started:** 2026-02-02T18:49:53Z
- **Completed:** 2026-02-02T18:52:59Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Process registry tracking all spawned PIDs with terminate package tree kill
- Graceful shutdown on all termination signals with 5-second timeout failsafe
- Buffered PTY wrapper solving node-pty race condition data loss issue
- Terminal raw mode restoration preventing corrupted terminal after crash

## Task Commits

Each task was committed atomically:

1. **Task 1: Create process cleanup registry** - `15df23e` (feat)
2. **Task 2: Create signal handlers for graceful shutdown** - `94f0bf5` (feat)
3. **Task 3: Create buffered PTY process manager** - `2f67488` (feat)

## Files Created/Modified
- `src/processes/cleanup.ts` - Global process registry with tree kill using terminate package
- `src/processes/lifecycle.ts` - Signal handlers for SIGINT/SIGTERM/SIGHUP/SIGQUIT with cleanup orchestration
- `src/processes/pty-manager.ts` - Buffered PTY wrapper preventing data-after-exit race condition
- `src/config/storage.ts` - Fixed TypeScript type bug in subscribe callback signature

## Decisions Made
- **Global singleton for process registry**: Ensures all parts of app track to same registry, simplifies integration
- **5-second timeout on cleanup**: Prevents app hanging forever if cleanup stalls, forces exit after reasonable wait
- **Buffer + real-time emit pattern**: PTY data emitted immediately for streaming AND buffered for complete output after exit
- **SIGTERM before SIGKILL**: Give processes chance to cleanup gracefully before force kill

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Jotai storage type signature**
- **Found during:** Task 2 (building lifecycle.ts triggered compilation)
- **Issue:** `createJotaiStorage` subscribe callback used `unknown` type instead of generic `T`, causing TypeScript error when atomWithStorage attempted to use it
- **Fix:** Changed subscribe signature to `(key: string, callback: (value: T) => void, initialValue: T)` to match Jotai's `Subscribe<T>` interface
- **Files modified:** src/config/storage.ts
- **Verification:** `npm run build` succeeded after fix
- **Committed in:** 94f0bf5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix necessary for TypeScript compilation. No scope change.

## Issues Encountered
None - all tasks executed as planned after fixing storage type bug.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Process lifecycle management complete
- Ready for agent execution implementation (will use BufferedPtyProcess)
- Ready for TUI implementation (lifecycle handlers prevent terminal corruption)
- Blocker removed: Terminal will be usable after crash (success criteria 4)
- Blocker removed: No zombie processes will be left behind (success criteria 5)

---
*Phase: 01-foundation*
*Completed: 2026-02-02*
