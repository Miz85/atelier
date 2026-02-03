# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-02)

**Core value:** Quickly spin up and switch between isolated coding agent workspaces without losing context or stepping on each other's work
**Current focus:** Phase 4 - UI/Navigation (next)

## Current Position

Phase: 4 of 5 (UI/Navigation)
Plan: 1 of TBD in current phase
Status: In progress
Last activity: 2026-02-03 — Completed 04-01-PLAN.md (UI State and Help Screen)

Progress: [████████████████] 100% (16 of 16+ plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 15
- Average duration: 9.5 min
- Total execution time: 2.5 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation | 4 | 13.0 min | 3.2 min |
| 02-workspace-management | 6 | 99.4 min | 16.6 min |
| 03-agent-integration | 5 | 36.8 min | 7.4 min |
| 04-ui-navigation | 1 | 2.0 min | 2.0 min |

**Recent Trend:**
- Last 5 plans: 03-02 (1.0m), 03-03 (1.2m), 03-04 (2.6m), 03-05 (30m), 04-01 (2.0m)
- Note: 03-05 included debugging and major refactor (node-pty → tmux)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: TUI over desktop/web — Developer tool, terminal-native workflow
- Phase 1: TypeScript + Ink — React patterns, good DX, familiar to many devs
- Phase 1: Git worktrees for isolation — True filesystem isolation
- 01-01: Use conf package for config persistence (XDG-compliant, battle-tested)
- 01-01: ESM module type with NodeNext module resolution
- 01-02: Use synchronous filesystem operations for Jotai's getItem requirement
- 01-02: Store state in ~/.equipe/state/*.json for XDG-adjacent simplicity
- 01-02: Use write-file-atomic for crash-safe persistence
- 01-03: Global process registry singleton — App-wide tracking, simplified integration
- 01-03: 5-second cleanup timeout — Prevents hanging on stalled cleanup
- 01-03: SIGTERM before SIGKILL — Graceful cleanup before force kill
- 01-04: React 18.x for Ink compatibility — 19.x causes type errors
- 01-04: Keyboard-first navigation — j/k/arrows for nav, Enter to edit, q/Esc to exit
- 01-04: Immediate settings persistence — No save button, changes persist via Jotai
- 02-01: Use execa $ template for git CLI execution — No shell injection risk, clean Promise API
- 02-01: Parse git worktree list --porcelain output — Stable machine-readable format
- 02-01: No --force flag on removeWorktree — Protects uncommitted changes
- 02-02: Use derived atom pattern for activeWorkspaceAtom — Separates persistence (ID) from computation (object lookup)
- 02-02: Persist only workspace ID, not full object — Maintains single source of truth in workspacesAtom
- 02-03: Use realpathSync for path resolution — Handles symlinks (e.g., /tmp → /private/tmp on macOS)
- 02-03: Workspace manager returns objects, caller handles state updates — Separation of orchestration and state management
- 02-05: Auto-detect repository default branch — Supports repos with non-standard default branches (main, master, preprod, develop)
- 02-05: Expand tilde in user-entered paths — Prevents ENOENT errors from unresolved ~ character
- 02-05: Return to main screen after workspace selection — Immediate feedback of active workspace change
- 02-06: Sync only on repoPath changes, not workspaces changes — Prevents infinite loop in useEffect
- 02-06: Derive workspace name from last branch segment — feature/test → test (simple and predictable)
- 03-01: Agent instances in-memory only — Agents are ephemeral processes, not persisted
- 03-01: PTY requires \r not \n — Terminal protocol requires carriage return for Enter key
- 03-01: 5-second graceful shutdown — SIGTERM first, then SIGKILL if needed (consistent with cleanup.ts)
- 03-01: Store workspacePath in AgentInstance — Required for restart functionality
- 03-02: Agent state is ephemeral, not persisted — Agents are processes, not data
- 03-02: Output lines capped at 1000 — Prevents memory bloat from long-running agents
- 03-02: Action atoms pattern for state updates — Write-only atoms with useSetAtom for clean separation
- 03-03: Use Ink's Static component for output — Append-only rendering suitable for streaming
- 03-03: Keyboard shortcuts s/x/r for agent control — Follows existing single-letter action pattern
- 03-03: Async loading state during stopAgent — Provides feedback during 5-second graceful shutdown
- 03-04: Tab key cycles through agent options — Simple single-key interaction for agent override
- 03-04: Map 'idle' status to 'stopped' for controls — AgentControls expects running/stopped/error only
- 03-04: Separate input mode for agent commands — Clean separation between viewing output and sending input
- 03-05: tmux over node-pty — Battle-tested terminal multiplexer handles all I/O complexity
- 03-05: spawnSync for tmux attach — Blocks Node.js completely to prevent Ink interference
- 03-05: Session persistence via tmux — Agents survive equipe crashes
- 04-01: No persistence for help visibility — Ephemeral state resets on app restart
- 04-01: HelpScreen only handles closing — Parent handles opening via ? key

### Pending Todos

None yet.

### Blockers/Concerns

None - Phase 4 progressing. UI state foundation ready.

## Session Continuity

Last session: 2026-02-03
Stopped at: Completed 04-01-PLAN.md (UI State and Help Screen)
Resume file: None
Next up: 04-02-PLAN.md (ThreePaneLayout integration)
