---
phase: 03-agent-integration
plan: 01
subsystem: agent
tags: [pty, process-management, agent-lifecycle, node-pty, claude-code, opencode]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: BufferedPtyProcess for reliable PTY handling
  - phase: 01-foundation
    provides: processRegistry for tracking spawned processes
  - phase: 02-workspace-management
    provides: Workspace interface with agent field
provides:
  - Agent spawning infrastructure (spawnAgent, stopAgent, restartAgent)
  - Agent instance tracking and lifecycle management
  - Input/output streaming via PTY
  - Support for both Claude Code and OpenCode agents
affects: [04-agent-ui, 05-integration-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - In-memory agent registry (Map<agentId, AgentInstance>)
    - Graceful shutdown pattern (SIGTERM with 5s timeout, then SIGKILL)
    - PTY lifecycle delegation to BufferedPtyProcess

key-files:
  created:
    - src/agents/types.ts
    - src/agents/spawn.ts
  modified: []

key-decisions:
  - "Agent instances tracked in-memory (not persisted) - ephemeral by nature"
  - "PTY requires \\r for Enter key, not \\n - terminal protocol requirement"
  - "Graceful shutdown with 5-second timeout - consistent with cleanup.ts pattern"
  - "Store workspacePath in AgentInstance - needed for restart functionality"

patterns-established:
  - "Agent lifecycle: spawnAgent → (optional stopAgent) → restartAgent pattern"
  - "Event-driven architecture: onData/onExit callbacks wired to PTY"
  - "Lookup patterns: by ID (getAgentInstance) or by workspace (getAgentByWorkspace)"

# Metrics
duration: 2min
completed: 2026-02-03
---

# Phase 3 Plan 1: Agent Spawn Infrastructure Summary

**Agent lifecycle management with PTY-based spawning, graceful shutdown, and restart for Claude Code and OpenCode**

## Performance

- **Duration:** 2 min (110 seconds)
- **Started:** 2026-02-03T08:43:42Z
- **Completed:** 2026-02-03T08:45:37Z
- **Tasks:** 2
- **Files modified:** 2 created

## Accomplishments
- Core agent spawning module with full lifecycle (spawn/stop/restart)
- Agent instance tracking with in-memory registry
- PTY-based I/O streaming with BufferedPtyProcess integration
- Support for both Claude Code and OpenCode agent types

## Task Commits

Each task was committed atomically:

1. **Task 1: Create agent types** - `682d84f` (feat)
2. **Task 2: Create agent spawn module** - `e131d11` (feat)

## Files Created/Modified
- `src/agents/types.ts` - AgentType, AgentCommand, AgentInstance, AgentEvents interfaces
- `src/agents/spawn.ts` - spawnAgent, stopAgent, restartAgent, sendInput, getAgentInstance, getAgentByWorkspace functions

## Decisions Made
- **Agent instances in-memory only:** Agents are ephemeral processes - tracking them in persisted state would create stale references on restart
- **PTY requires \\r not \\n:** Terminal protocol requires carriage return for Enter key, handled in sendInput
- **5-second graceful shutdown:** Matches cleanup.ts timeout pattern - SIGTERM first, then SIGKILL if needed
- **Store workspacePath in AgentInstance:** Required for restart functionality to respawn agent in correct directory

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added workspacePath field to AgentInstance**
- **Found during:** Task 2 (implementing restartAgent function)
- **Issue:** restartAgent needs workspace path to respawn agent, but AgentInstance didn't store it
- **Fix:** Added workspacePath: string field to AgentInstance interface, populated in spawnAgent
- **Files modified:** src/agents/types.ts, src/agents/spawn.ts
- **Verification:** TypeScript compilation passed, build succeeded
- **Committed in:** e131d11 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Bug fix necessary for restart functionality. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Agent spawning infrastructure complete and tested (build passes)
- Ready for agent UI components (Phase 3 Plan 2)
- Ready for agent-workspace integration (Phase 3 Plan 3)
- No blockers

---
*Phase: 03-agent-integration*
*Completed: 2026-02-03*
