# Project Research Summary

**Project:** equipe - TUI Agent Orchestrator
**Domain:** Terminal User Interface (TUI) for coding agent orchestration with git worktree management
**Researched:** 2026-02-02
**Confidence:** HIGH

## Executive Summary

This project is a terminal-based orchestration platform for managing multiple coding agents (Claude Code, OpenCode) across isolated git worktrees. The recommended approach follows proven TUI patterns: use Ink (React for CLIs) with node-pty for process management, Jotai atoms for reactive state, and simple-git for worktree operations. The three-pane layout (agent output | diff viewer | terminal) is standard in developer tools like lazygit and k9s.

The core technical challenge is managing process lifecycles correctly. Node-pty has known race conditions where data events fire after exit events, requiring careful buffering and state machine implementation. Proper cleanup on crashes is critical - without exit handlers, the terminal stays in raw mode and orphaned processes accumulate. These aren't "nice-to-haves" but fundamental reliability requirements that must be built into Phase 1.

The biggest risk is attempting to build this as a traditional web app rather than following TUI conventions. Terminal applications have strict expectations: keyboard-first navigation, no blocking operations, graceful degradation on resize, and bulletproof cleanup. The stack research confirms Ink + TypeScript + node-pty is the industry standard combination (used by GitHub Copilot, VS Code terminal features, etc.). Performance optimization will be critical - batching updates and virtualizing output prevents UI lag when agents produce thousands of lines per second.

## Key Findings

### Recommended Stack

The stack is well-established with high confidence. Ink (2.1M weekly downloads, 34.6k stars) is the clear winner for React-based TUIs, providing Flexbox layouts via Yoga and declarative component models. Process management requires two layers: execa for one-shot commands (git operations) and node-pty for interactive sessions (agent CLIs, shell panes). Simple-git wraps git CLI with TypeScript support, using .raw() for worktree commands. Jotai provides atomic state management ideal for TUI apps where multiple panels need synchronized views of the same data.

**Core technologies:**
- **Ink 5.x + React 19.x**: TUI framework with declarative components and Flexbox layouts - industry standard with excellent TypeScript support
- **node-pty 1.1+**: PTY process management for interactive terminals - Microsoft-maintained, required for agent CLI embedding
- **execa 9.x**: Modern process spawning for git/gh commands - prevents shell injection, promise-based, streams support
- **simple-git 3.x**: Git CLI wrapper with TypeScript definitions - supports worktree operations via .raw() method
- **Jotai 5.x**: Atomic state management - minimal re-renders, perfect for multi-pane TUIs with shared state
- **Octokit**: Official GitHub API client for PR creation and management
- **@clack/prompts**: Interactive CLI prompts for setup flows - modern, 80% smaller than alternatives

**Critical version notes:**
- Node.js 18+ required (Octokit needs native fetch API)
- Ink requires Babel preset-react for JSX compilation
- node-pty requires native compilation (node-gyp)

### Expected Features

Research shows clear table stakes vs. differentiators. Multi-pane layout, keyboard navigation, and workspace isolation are expected - users coming from lazygit/k9s/tmux assume these exist. The core value proposition is agent comparison and checkpoint systems, which no existing tool provides.

**Must have (table stakes):**
- Three-pane layout with focus management (agent | diff | terminal)
- Workspace CRUD (create/delete git worktrees with bound agent instances)
- Agent process management (start/stop/monitor Claude Code or OpenCode)
- Basic diff viewing with syntax highlighting
- Keyboard navigation (Tab between panes, arrow keys within panes)
- Help system (? key for shortcuts overlay)
- Session persistence (resume workspaces after disconnection)
- Error handling without crashing TUI

**Should have (competitive advantage):**
- Agent comparison view (side-by-side outputs for same task - unique differentiator)
- Checkpoint/rewind system (save state before changes, rollback if needed)
- Task queue per workspace (queue multiple prompts sequentially)
- Diff approval workflow (review/approve/reject changes file-by-file)
- PR creation integration (one-command flow to create PR from approved changes)
- Resource limits per workspace (max tokens/cost/time via CLI flags)
- Live workspace dashboard (overview of all workspaces: status, cost, progress)

**Defer (v2+):**
- Agent handoff (transfer tasks between agents - complex, unclear demand)
- Session recording/playback (debugging feature, non-critical)
- Hot reload configuration (nice-to-have DX improvement)
- Shared context across agents (high complexity, needs validation)

**Anti-features (do NOT build):**
- Real-time collaboration (adds auth/sync/network complexity, dilutes focus)
- Automatic merging of agent changes (agents make mistakes, review is essential)
- Visual GUI fallback (splits development effort, different paradigm)
- Built-in git operations beyond worktrees (scope creep, lazygit handles this)

### Architecture Approach

The architecture follows event-driven orchestration with clear separation of concerns. Four layers: Presentation (Ink components), State (Jotai atoms), Orchestration (managers for workspace/agent/git/PR), and Process (PTY supervisor). This bottom-up structure ensures stable foundations with volatile integration at the top.

**Major components:**
1. **PTYManager** — Spawns and monitors interactive processes (agents, shells) using node-pty. Handles resize, data buffering, exit cleanup. Emits events for data/exit that services consume.
2. **WorkspaceManager** — Creates/deletes git worktrees, validates paths, syncs worktree state. Uses simple-git for operations, stores metadata (path, branch, locked status).
3. **AgentManager** — Spawns agent CLIs in worktree context, streams output to atoms, handles crashes. Listens to git changes to notify agents of code updates.
4. **GitManager** — Generates diffs, watches file changes (chokidar), emits git events. Debounces to prevent excessive CPU from large repos.
5. **PRManager** — Integrates with GitHub via gh CLI or Octokit, creates PRs from approved changes, links sessions to PRs.

**Critical patterns:**
- **Jotai atoms for state**: Each piece of state is independent atom. Components subscribe only to what they need, minimizing re-renders.
- **Event-driven coordination**: Managers emit domain events (workspace-created, git-changed) to decouple services.
- **Virtualized scrolling**: Render only visible lines in agent output panes to handle thousands of lines without performance death.
- **Focus management**: Use Ink's useFocusManager with explicit focusId, not automatic Tab ordering which breaks on render changes.
- **Configuration hierarchy**: Defaults → global config → workspace config → runtime overrides, validated with Zod schemas.

### Critical Pitfalls

Based on real-world issues from node-pty, Ink, and git worktree tooling. These are not theoretical - they're documented bugs and production failures.

1. **Process lifecycle race conditions (node-pty)** — Data events fire after exit events due to buffering. Missing final output lines (especially errors) breaks debugging. **Solution**: Implement 100-200ms grace period after exit, buffer data with state machine (running → exiting → terminated).

2. **Terminal state not restored on crash** — When TUI crashes, terminal stays in raw mode (no echo, unusable). **Solution**: Register cleanup with process.on('exit'), process.on('SIGINT'), process.on('SIGTERM'). Call Ink's unmount() in ALL exit paths. Test with SIGTERM.

3. **Zombie processes from CLI spawning** — Each spawned git/gh/agent process becomes zombie if not cleaned up. Accumulates until system exhaustion. **Solution**: Track all PIDs in Map, kill on exit. Use 'terminate' package for process trees. Never spawn without tracking.

4. **Alternate screen buffer not cleared properly** — Terminal.app doesn't handle alternate screen correctly, leaving UI visible or clearing user's scroll history. **Solution**: Test on multiple terminals (iTerm2, Terminal.app, Alacritty). Provide config to disable alternate screen. Write critical output to stderr.

5. **Focus management with multiple input components** — Three panes with Tab navigation becomes unpredictable. Focus "sticks" or goes to wrong pane. **Solution**: Use useFocusManager with explicit focusId. Store active pane in top-level state. Visual indicators (border color) must match actual focus.

6. **Git worktree path not synchronized with TUI state** — Async git operations complete unpredictably, TUI shows wrong worktree as active. Commands execute in wrong directory. **Solution**: Treat worktree operations as transactions (lock UI during). Verify existence before every operation with git worktree list --porcelain.

7. **Terminal resize not propagated to PTYs** — User resizes terminal, Ink layout adapts, but agent CLI panes think they're still old size. Output wraps incorrectly. **Solution**: Listen to process.stdout.on('resize'), call pty.resize(cols, rows) for all active PTYs.

8. **Memory leak from uncleared diff listeners** — Each workspace switch adds file watchers/listeners that never clean up. App crashes after 10+ switches. **Solution**: Every useEffect that spawns process or adds listener MUST return cleanup function. Use AbortController for processes.

9. **Ink re-render overhead killing performance** — Rapid agent output (thousands of lines/sec) triggers re-render per line. UI becomes unresponsive, keystrokes lag. **Solution**: Batch updates (flush every 50-100ms), use <Static> for history, virtualize viewport (render only visible lines).

10. **stdout/stderr interleaving lost** — Node buffers stdout/stderr separately, destroying temporal order. Errors appear before commands that caused them. **Solution**: Use node-pty (merges streams naturally) instead of spawn. Add timestamps if using separate streams.

## Implications for Roadmap

Based on research, bottom-up build order is essential. Each layer depends on the one below. Foundation (PTYManager, atoms, stores) must be rock-solid before building UI components.

### Phase 1: Foundation - Core Infrastructure
**Rationale:** Process management and state fundamentals are most stable and most critical. Everything depends on PTY lifecycle, cleanup handlers, and reactive state. This must work perfectly before building anything else.

**Delivers:**
- PTYManager with robust exit handling and cleanup
- Jotai atoms for workspace/agent/ui state
- ConfigManager for settings hierarchy
- WorkspaceStore for persistence
- Terminal cleanup handlers (exit, SIGINT, SIGTERM)

**Addresses:**
- Process lifecycle race conditions (Pitfall 1)
- Terminal state restoration (Pitfall 2)
- Zombie process prevention (Pitfall 3)

**Stack elements:**
- node-pty 1.1+ for PTY abstraction
- Jotai 5.x for atomic state
- TypeScript 5.x with strict mode

**Critical tests:**
- Send SIGTERM, verify terminal usable and no orphaned processes
- Spawn 10 PTYs, kill app, verify all cleaned up
- Buffer data after exit event for 200ms, verify no lost output

### Phase 2: Business Logic - Domain Services
**Rationale:** Services orchestrate domain operations (worktree, agent, git, PR). Must work correctly before UI consumes them. Integration tests with real git repos validate behavior.

**Delivers:**
- WorkspaceManager (git worktree create/delete/list)
- AgentManager (spawn Claude Code/OpenCode, monitor state)
- GitManager (diff generation, file watching, event emission)
- PRManager (GitHub integration via gh CLI)

**Addresses:**
- Git worktree path synchronization (Pitfall 6)
- Event-driven orchestration between services

**Stack elements:**
- simple-git 3.x for worktree operations
- execa 9.x for git/gh commands
- chokidar for file watching (debounced)

**Critical tests:**
- Create worktree, delete directory manually, verify graceful handling
- Spawn agent, resize terminal, verify PTY resizes (Pitfall 7)
- Switch workspaces 50 times, verify no memory leaks (Pitfall 8)

### Phase 3: UI Components - Presentation Layer
**Rationale:** Components read from atoms updated by services. Can't test properly without working services. Build widgets first (reusable), then panels (domain-specific), then layouts (compositions).

**Delivers:**
- ScrollableBox with virtualized rendering
- FocusablePane with visual indicators
- AgentPanel, DiffPanel, TerminalPanel
- ThreePaneLayout with keyboard navigation
- StatusBar with workspace info
- Root App component

**Addresses:**
- Focus management with multiple inputs (Pitfall 5)
- Ink re-render performance (Pitfall 9)
- Alternate screen buffer issues (Pitfall 4)

**Stack elements:**
- Ink 5.x + React 19.x for components
- chalk 5.x for inline text styling
- Flexbox layout via Yoga

**Critical tests:**
- Tab through panes, verify focus indicator matches stdin routing
- Stream 10k lines, verify UI responsive (>30fps)
- Test on Terminal.app, iTerm2, Alacritty for alternate screen

### Phase 4: Integration - Wiring Everything Together
**Rationale:** Individual pieces work but need coordination. Event wiring, keyboard shortcuts, error boundaries, persistence. This is where it all comes together into a cohesive product.

**Delivers:**
- Event wiring between services (git changes → diff updates)
- Complete keyboard navigation (Tab, arrow keys, vim-style hjkl)
- Error boundaries with context (which worktree, which command)
- Session persistence (save/restore workspace list)
- Help system (? key for shortcuts)
- Graceful degradation (terminal too small warning)

**Addresses:**
- End-to-end workflows
- Error handling without crashes
- Session persistence (table stakes feature)

**Critical tests:**
- End-to-end: create workspace → spawn agent → view diff → approve → create PR
- Crash test: kill -9, verify terminal usable
- Memory test: run for hours with agent output, verify stable

### Phase 5: Diff & Approval - Review Workflow
**Rationale:** Can't create PRs without approval workflow. Diff viewing enables review. This phase completes the core value proposition: orchestrate agents, review changes, ship to PR.

**Delivers:**
- Diff viewer with syntax highlighting
- File-by-file approval/rejection
- Diff approval state tracking
- Integration with PR creation (gh pr create)

**Addresses:**
- Diff approval workflow (should-have feature)
- PR creation integration (should-have feature)
- Memory leaks from diff watchers (Pitfall 8)

**Stack elements:**
- git diff parsing with ANSI colors preserved
- GitHub API via gh CLI or Octokit

**Critical tests:**
- Approve changes, create PR, verify PR contains approved changes only
- Switch workspaces during diff calculation, verify no memory leak

### Phase 6: Advanced Features - Competitive Differentiators
**Rationale:** Core product is complete (Phases 1-5). Now add features that set this apart: agent comparison, checkpoint system, task queue, dashboard.

**Delivers:**
- Agent comparison view (side-by-side outputs)
- Checkpoint/rewind system (git commits as snapshots)
- Task queue per workspace (sequential prompt processing)
- Live workspace dashboard (status/cost/progress overview)
- Resource limits (--max-budget-usd integration)

**Addresses:**
- Agent comparison (unique differentiator)
- Checkpoint system (should-have feature)
- Task queue (should-have feature)
- Dashboard (should-have feature)

**Research flags:**
- Agent comparison needs UX research: How to display 2-3 agent outputs simultaneously?
- Checkpoint system needs git research: Best way to snapshot worktree state without polluting history?

### Phase Ordering Rationale

**Why bottom-up:** Each layer depends on the one below. PTYManager (Phase 1) is used by AgentManager (Phase 2), which updates atoms consumed by AgentPanel (Phase 3). Building top-down would mean constantly refactoring as foundations change.

**Why foundation first:** Process lifecycle bugs (race conditions, zombie processes, terminal corruption) are showstoppers. They must be solved in Phase 1 before users ever interact with the product. These aren't "we'll fix it later" issues - they're "product is unusable" issues.

**Why services before UI:** Business logic tested independently prevents UI bugs masking service bugs. If WorkspaceManager has path sync issues (Pitfall 6), catch it in Phase 2 unit tests, not Phase 3 when users report mysterious git errors.

**Why integration comes late:** Integration is most volatile. As features evolve, wiring changes. Keyboard shortcuts get added, event flows adjust, error handling improves. Building integration first means constant rework. Building it after components work independently means connecting proven pieces.

**Why differentiators last:** Agent comparison and checkpoint systems are valuable but not essential for core workflow. Phases 1-5 deliver "orchestrate agents across worktrees with review and PR creation" - that's the MVP. Phase 6 adds competitive advantages once core is solid.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 5 (Diff & Approval):** Syntax highlighting for diffs requires choosing a library (shiki vs highlight.js vs tree-sitter). Need to research performance with large diffs and ANSI code preservation.

- **Phase 6 (Agent Comparison):** No existing tools do this - need UX research on how to display multiple agent outputs. Split screen? Tabs? Overlay? This needs design exploration, not just implementation.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Foundation):** Process management and state patterns are well-documented. node-pty examples exist, Jotai docs are comprehensive. Straightforward implementation.

- **Phase 2 (Business Logic):** Git worktree operations are documented, execa usage is standard. No novel patterns needed.

- **Phase 3 (UI Components):** Ink component patterns are established. Examples exist for focus management, scrolling, layouts. Follow existing TUI conventions.

- **Phase 4 (Integration):** Event wiring and keyboard shortcuts are standard TUI patterns. No research needed beyond reading lazygit/k9s for UX conventions.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official docs verified, versions confirmed, adoption metrics strong. Ink + node-pty + Jotai is proven combination. |
| Features | HIGH | Table stakes validated against lazygit/k9s/tmux conventions. Differentiators validated against worktrunk/Claude Code gaps. |
| Architecture | HIGH | Patterns sourced from official Ink docs, node-pty best practices, real-world TUI projects. Bottom-up build order is standard. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls verified with GitHub issues (node-pty #72, Claude Code #2734, BubbleTea #1455). Some performance thresholds estimated. |

**Overall confidence:** HIGH

Research is backed by official documentation, verified GitHub issues, and production TUI projects. Stack choices have consensus (Ink dominates React-based TUIs with 2.1M weekly downloads). Architecture patterns follow established TUI conventions. Pitfalls are documented real-world issues, not speculation.

### Gaps to Address

**Performance thresholds:** Exact batching intervals (50-100ms) and buffer sizes (N lines) are estimates. Need profiling during Phase 2 to tune for specific terminal emulators and hardware. Different terminals handle rapid output differently.

**Git worktree edge cases:** Worktree repair/prune behavior after manual filesystem changes needs validation. Git documentation is comprehensive but real-world testing with corrupted state is needed in Phase 2.

**Multi-agent race conditions:** Handling simultaneous output from 3+ agents to different panes is less documented. Ink's rendering is synchronous but event timing matters. Need stress testing in Phase 4 integration.

**Terminal emulator compatibility:** Alternate screen behavior varies (Terminal.app broken, iTerm2 works). Need testing matrix in Phase 1 across macOS (Terminal.app, iTerm2, Alacritty), Linux (gnome-terminal, konsole, alacritty), Windows (Windows Terminal, ConEmu).

**Agent CLI parsing:** Claude Code and OpenCode output formats aren't formally specified. Parsing agent state (idle, working, error) from output requires reverse engineering. Need validation in Phase 2 with real agent sessions.

## Sources

### Primary (HIGH confidence)
- Ink GitHub Repository — TUI framework docs, component patterns, focus management, version info
- node-pty GitHub Repository — PTY process management, known issues, TypeScript examples
- Jotai Official Documentation — Atomic state patterns, React integration, performance characteristics
- Execa GitHub Repository — Process spawning API, v9 release notes, security patterns
- simple-git GitHub Repository — Git worktree operations, TypeScript definitions
- Octokit GitHub Repository — GitHub API client, TypeScript configuration
- Node.js Child Process Documentation — Process management fundamentals

### Secondary (MEDIUM confidence)
- Git Worktree Documentation — Official git-worktree reference, --porcelain format
- Lazygit GitHub — TUI UX patterns, keyboard navigation conventions
- K9s GitHub — Multi-pane dashboard patterns, process management
- Worktrunk CLI — Git worktree + agent integration patterns
- Claude Code CLI Reference — Agent features, session management, flag documentation
- GitHub CLI (gh) Manual — PR creation API, authentication

### Verified Issues (MEDIUM-HIGH confidence)
- node-pty Issue #72 — Data events after exit (race condition since 2017)
- Claude Code Issue #2734 — stdout/stderr interleaving broken
- BubbleTea Issue #1455 — Alternate screen broken in Terminal.app
- OpenCode TUI Crashes (Issue #4606) — Recent TUI crash patterns

### Community Resources (MEDIUM confidence)
- TUI Development: Ink + React (2025 article) — Modern patterns and practices
- Building Terminal Interfaces with Node.js — Architecture patterns, resize handling
- What Is a Zombie Process and How to Avoid It — Process cleanup patterns
- Understanding Terminal Specifications for TUI Development — Line discipline, signals
- npm trends comparison — Download statistics, adoption metrics for alternatives

---
*Research completed: 2026-02-02*
*Ready for roadmap: yes*
