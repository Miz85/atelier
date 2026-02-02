# Pitfalls Research

**Domain:** TUI application for orchestrating coding agents with child process management
**Researched:** 2026-02-02
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: Process Lifecycle Race Conditions (node-pty)

**What goes wrong:**
Data events fire after exit events, causing race conditions where output from terminated processes appears out of order or gets lost. When managing multiple agent sessions through node-pty, you may receive data callbacks after the process has already signaled exit, leading to incomplete logs or UI corruption.

**Why it happens:**
node-pty's event emission order is non-deterministic. This is a [known architectural issue dating to 2017](https://github.com/microsoft/node-pty/issues/72) that remains unresolved. The pty's internal buffering and Node's event loop timing create unavoidable race conditions between data and exit events.

**How to avoid:**
- Implement a grace period buffer: Continue listening for data events for 100-200ms after receiving exit
- Track process state explicitly: Mark processes as "exiting" when exit fires, buffer any subsequent data events
- Use a state machine: `running → exiting → terminated` with appropriate data handling in each state
- Add sequence numbers to data chunks to detect and handle out-of-order delivery

**Warning signs:**
- Missing final output lines in agent CLI panes (especially error messages)
- Logs showing "[process exited]" before the actual command output appears
- Intermittent test failures where process output verification fails
- Users reporting "the agent stopped but I can't see what went wrong"

**Phase to address:**
Phase 1 (Basic Process Management) - Must implement robust process lifecycle handling from the start. This is foundational and cannot be retrofitted easily.

---

### Pitfall 2: Terminal State Not Restored on Crash

**What goes wrong:**
When your TUI crashes or exits unexpectedly (unhandled exception, SIGKILL, etc.), the terminal remains in raw mode. Users' terminals become unusable - no echo, no line buffering, invisible input. They must manually run `reset` to recover.

**Why it happens:**
Raw mode disables terminal line discipline (echo, canonical mode, signal generation). Ink and other TUI frameworks enable raw mode but cleanup only happens in graceful exit paths. Crashes bypass cleanup handlers, leaving the terminal corrupted.

**How to avoid:**
- Register cleanup with `process.on('exit')` - runs even on crashes (but not SIGKILL)
- Use `process.on('SIGINT')` and `process.on('SIGTERM')` to catch signals
- Call Ink's `unmount()` returned from `render()` in ALL exit paths
- Consider wrapping the entire app in a try-finally that restores terminal state
- Test cleanup: Run app, send SIGTERM, verify terminal is usable afterward

**Warning signs:**
- After testing crashes, your terminal requires `reset` command
- CI tests leave terminal in bad state
- Users report "terminal broke" after force-quitting
- Terminal echo stops working during development

**Phase to address:**
Phase 1 (Basic TUI Setup) - Must be in place before any real usage. This is a showstopper for users if not handled correctly.

---

### Pitfall 3: Zombie Processes from CLI Spawning

**What goes wrong:**
Spawning git, gh, or agent CLIs without proper cleanup creates zombie processes that accumulate, consuming system resources. On crash or improper shutdown, orphaned child processes continue running in the background, potentially interfering with worktrees or holding file locks.

**Why it happens:**
Node's `child_process.spawn()` creates processes that [become zombies if parent doesn't wait for exit status](https://saturncloud.io/blog/what-is-a-zombie-process-and-how-to-avoid-it-when-spawning-nodejs-child-processes-on-cloud-foundry/). When your TUI crashes, spawned git/gh processes become orphaned. Without explicit `.kill()` calls in exit handlers, they persist indefinitely.

**How to avoid:**
- Track all spawned child processes in a Map/Set by PID
- Install exit handlers: `process.on('exit', () => childProcesses.forEach(p => p.kill()))`
- Use the [`terminate` package](https://www.npmjs.com/package/terminate/v/2.5.0) to kill entire process trees (handles child processes of child processes)
- Listen to child process `'exit'` events to clean up tracking
- Never spawn without adding to tracking - consider a wrapper function
- On app shutdown: Kill tracked processes THEN unmount TUI

**Warning signs:**
- Running `ps aux | grep "git\|gh\|claude-code"` shows processes after app exits
- Tests leave behind processes
- "Address already in use" or "resource busy" errors on restart
- MacOS showing "equipe quit unexpectedly" with many child processes
- Increasing memory usage over time

**Phase to address:**
Phase 2 (Agent Integration) - Critical before multi-agent support. One leaked process per session = disaster.

---

### Pitfall 4: Alternate Screen Buffer Not Properly Cleared

**What goes wrong:**
On exit, the alternate screen buffer doesn't clear properly, leaving your TUI's UI visible in the terminal or clearing content users wanted to reference. In some terminal emulators (especially Terminal.app), [alternate screen doesn't work correctly](https://github.com/charmbracelet/bubbletea/issues/1455) - instead of a true alternate buffer, it pushes content up with blank lines.

**Why it happens:**
Different terminal emulators handle alternate screen buffer escape sequences (`\e[?1049h` / `\e[?1049l`) inconsistently. Ink uses alternate screen by default but cleanup depends on process exit timing and terminal emulator support.

**How to avoid:**
- Test on multiple terminals: iTerm2, Terminal.app, Alacritty, Windows Terminal, Linux terminals
- Provide config option to disable alternate screen for problem terminals
- In cleanup handlers, explicitly send `\e[?1049l` before exit
- Consider Ink's `stdin` option to manage alternate screen manually
- For critical output (errors, completion messages), write to stderr which persists after cleanup

**Warning signs:**
- After exit, terminal scroll history is corrupted
- Users report "can't see what the tool did after it exits"
- Terminal content gets pushed off-screen on app launch
- UI elements remain visible after clean exit
- Different behavior between `Ctrl-C` exit and normal exit

**Phase to address:**
Phase 1 (Basic TUI Setup) - Test early across multiple terminals. Users will complain loudly if this breaks.

---

### Pitfall 5: Focus Management with Multiple Input Components

**What goes wrong:**
With three panes (agent CLI, diff viewer, terminal), stdin routing becomes unpredictable. Keypresses go to the wrong pane, Tab navigation skips components, or multiple inputs receive the same keypress simultaneously.

**Why it happens:**
Ink's `useFocus` hook gives focus in render order, not logical order. If component tree structure changes (conditional rendering, React state updates reordering children), focus order breaks. [Multiple inputs need explicit routing](https://github.com/vadimdemedes/ink), but documentation is sparse on complex layouts.

**How to avoid:**
- Use `useFocusManager` to explicitly control focus, not rely on automatic Tab ordering
- Assign stable `focusId` to each pane component (not dependent on render order)
- Implement visual focus indicators immediately - users need to see which pane is active
- Single source of truth: Store active pane in top-level state, not multiple local states
- Test focus behavior: Tab forward, Tab backward, direct focus switching
- Consider vim-style navigation: `Ctrl-H/J/K/L` to move between panes, more explicit than Tab

**Warning signs:**
- Pressing Tab does nothing or cycles unexpectedly
- Typing appears in diff viewer when agent CLI should have focus
- Visual focus indicator doesn't match actual focus
- Keypresses sometimes appear in multiple panes
- Focus gets "stuck" on a component and won't move

**Phase to address:**
Phase 3 (Three-Pane Layout) - Core to the multi-pane UX. Must be solid before shipping.

---

### Pitfall 6: STDOUT/STDERR Interleaving Lost

**What goes wrong:**
Agent output that carefully interleaves stdout and stderr (e.g., progress on stdout, warnings on stderr) appears out of order. Users see warnings before the operations they warn about, or error messages separated from the commands that caused them.

**Why it happens:**
When spawning processes, Node buffers stdout and stderr separately. They're read on different schedules, destroying temporal ordering. [Claude Code's bash tool has this exact issue](https://github.com/anthropics/claude-code/issues/2734). With multiple PTYs (multiple agent panes), buffering and event loop timing makes this worse.

**How to avoid:**
- Use `node-pty` (pseudoterminal) instead of `child_process.spawn` - PTYs merge streams naturally
- If using spawn: Set `stdio: ['pipe', 'pipe', 'pipe']` and manually interleave by timestamp
- Add timestamps to every line in your internal model: `{timestamp, stream: 'stdout'|'stderr', text}`
- Display in chronological order, not by stream
- For git commands, consider using `--color=always` to preserve ANSI codes through PTY
- Provide visual distinction: Different colors for stdout vs stderr even when interleaved

**Warning signs:**
- Error messages appear before the command that caused them
- Users report "confusing output order"
- When comparing to running command directly in terminal, order is different
- Test output verification fails intermittently due to ordering
- Diff viewer shows stderr block, then stdout block (wrong)

**Phase to address:**
Phase 2 (Agent Integration) - Critical for multi-agent orchestration where output order matters for debugging.

---

### Pitfall 7: Git Worktree Path Not Synchronized with TUI State

**What goes wrong:**
TUI shows one worktree as active, but git operations execute in the wrong directory. Users create commits in the wrong worktree, pull requests reference wrong branches, or "not a git repository" errors occur despite UI showing valid workspace.

**Why it happens:**
Asynchronous git operations (worktree add, worktree remove, git checkout) complete at unpredictable times. If TUI state updates before git operation completes, subsequent operations fail. If state updates after user switches workspaces, race condition. Worktree paths can also become invalid if user manually deletes directories or git prune runs.

**How to avoid:**
- Treat git worktree operations as transactions: Lock UI during worktree create/delete
- Verify worktree existence before every operation: `fs.existsSync(worktreePath) && isGitRepo(worktreePath)`
- Use `git worktree list --porcelain` to get source of truth, not just stored state
- Store worktree metadata: `{path, branch, gitDir, locked: boolean}`
- On workspace switch: Verify worktree, update process cwd for spawned commands
- Handle stale worktrees gracefully: "This worktree no longer exists. Remove from list?"

**Warning signs:**
- "fatal: not a git repository" in UI despite workspace listed
- Commits appear in wrong branch
- Diff viewer shows changes from different worktree than selected
- `git status` output doesn't match UI state
- Users report "it worked yesterday, now it's broken" (manual deletion)

**Phase to address:**
Phase 2 (Worktree Management) - Foundational to the entire tool. Must be bulletproof before agent integration.

---

### Pitfall 8: Terminal Resize Not Propagated to PTYs

**What goes wrong:**
User resizes terminal window, but agent CLI panes don't resize. Output wraps incorrectly, TUI layout breaks, or agent processes think they're still running in old terminal dimensions (breaking prompts, progress bars, table layouts).

**Why it happens:**
Terminal resize sends SIGWINCH signal, which Ink handles for its own rendering. But spawned PTYs (node-pty instances for agent CLIs) have independent dimensions. If you don't explicitly resize the PTY when terminal resizes, agent processes keep using old dimensions.

**How to avoid:**
- Listen to `process.stdout.on('resize')` events
- For each active PTY: Call `pty.resize(columns, rows)` with new dimensions
- Ink's layout gives you component dimensions - propagate to underlying PTY
- Handle resize during process execution: agent CLI might redraw UI
- Test: Start app, start agent process, resize terminal dramatically, verify agent UI adapts

**Warning signs:**
- Agent CLI output wraps at old terminal width after resize
- Progress bars or spinners break after window resize
- Ink UI resizes correctly but agent output in panes doesn't
- ANSI escape codes visible (escape sequences calculated for wrong width)
- Users report "UI is messed up after I resize"

**Phase to address:**
Phase 2 (Agent Integration) - Must handle before real agent usage. Agent CLIs often use full-width UIs.

---

### Pitfall 9: Memory Leak from Uncleared Diff Listeners

**What goes wrong:**
As users switch between worktrees repeatedly, memory usage grows until app crashes or system runs out of memory. Each worktree switch adds event listeners or stores diff data that never gets cleaned up.

**Why it happens:**
React components in Ink create effect cleanup functions, but if you spawn file watchers, git diff processes, or register event listeners for diff updates without cleanup, they persist across workspace switches. With 10+ workspace switches, you have 10+ sets of watchers still running.

**How to avoid:**
- Every `useEffect` that spawns a process or adds a listener MUST return cleanup function
- Store watcher references in refs, not state (avoids triggering re-renders)
- On workspace switch: Explicit cleanup of previous workspace's resources
- Use AbortController for spawned processes to cancel in cleanup
- Monitor memory in development: Watch for growth over repeated workspace switches
- Consider singleton pattern for diff calculation: One diff service, not per-workspace instances

**Warning signs:**
- Memory usage grows with each workspace switch
- App slows down over time
- Eventually crashes with out-of-memory
- `ps aux` shows many backgrounded git processes
- Node's event emitter warnings: "MaxListenersExceededWarning"

**Phase to address:**
Phase 4 (Diff Viewer Integration) - Critical for long-running usage. Users will switch workspaces many times.

---

### Pitfall 10: Ink Re-render Overhead Killing Performance

**What goes wrong:**
When agent produces rapid output (thousands of lines per second), Ink re-renders on every line. UI becomes unresponsive, keystrokes lag, terminal struggles to keep up. What should be smooth streaming becomes stuttery or frozen.

**Why it happens:**
Ink re-renders entire component tree on every state change. If you update state for every line of agent output, you trigger full reconciliation for each line. Ink 3 improved performance (2x), but [high-frequency re-renders still hurt](https://vadimdemedes.com/posts/ink-3). React's reconciliation isn't free.

**How to avoid:**
- Batch updates: Accumulate output lines, flush to state every 50-100ms (not per line)
- Use Ink's `<Static>` component for output history (doesn't re-render)
- Virtualization: Only render visible lines in viewport (infinite scroll pattern)
- Throttle diff updates: Recalculate diff every 200ms, not on every file change
- Consider ringbuffer: Keep last N lines in state, older lines in `<Static>`
- Profile with React DevTools: Find hot components and optimize

**Warning signs:**
- Typing lag when agent is producing output
- CPU usage spikes during agent output
- Terminal emulator becomes unresponsive (especially on non-GPU terminals)
- Frame rate drops observable to users
- Tests timeout waiting for renders to complete

**Phase to address:**
Phase 2 (Agent Integration) - Must optimize before users connect real agents. Some agents are extremely verbose.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip terminal state cleanup in happy path | Faster development | Users with corrupted terminals after crashes | Never - cleanup handlers are 10 lines of code |
| Use `child_process.spawn` instead of `node-pty` | Simpler API, fewer dependencies | Broken ANSI codes, no interactive processes, stdout/stderr ordering issues | Only for simple one-shot commands (git status), never for interactive agents |
| Store all output in React state | Simple state model | Memory leaks, performance death on large output | Only in MVP with output limits (<1000 lines) |
| Tab key for focus switching | Built-in Ink behavior | Unpredictable focus order, not discoverable | Never for production - use explicit navigation |
| Rely on Ink's default error boundaries | Catches unhandled errors | Generic error messages, no context for debugging | Only in early development - add custom boundaries by Phase 1 |
| Sync git operations without feedback | Simpler code flow | UI freezes during slow git operations | Only for fast operations (<100ms), never worktree create/clone |
| Single global state object | Easy to access anywhere | Renders entire tree on any change | Never with high-frequency updates (agent output) |
| Skip worktree path validation | Fewer checks | Cryptic git errors, wrong repository operations | Never - validation is 2 lines and prevents disasters |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| git CLI | Assuming cwd is correct | Always pass explicit `--git-dir` and `--work-tree` flags |
| gh CLI | Not handling "not logged in" state | Check `gh auth status` before operations, provide clear "run gh auth login" message |
| Claude Code | Expecting instant response | Claude Code can be slow to start; show "initializing..." state |
| node-pty | Assuming data arrives in complete lines | Buffer partial lines, emit only on newline or timeout |
| git worktree | Creating worktrees with relative paths | Always resolve to absolute paths, relative paths break when cwd changes |
| Ink stdin | Reading input directly from process.stdin | Use Ink's `useInput` hook, direct stdin access conflicts with Ink |
| ANSI escape codes | Stripping them for parsing | Preserve in display, strip only for length calculations (use `strip-ansi` package) |
| git worktree list | Parsing human-readable output | Use `--porcelain` flag for machine-readable output |
| process.exit() | Calling directly | Call cleanup handlers first, then `process.exit(0)` - or better, return from main |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Storing full output history in state | Lag when typing after agent runs | Use `<Static>` for history + ringbuffer for recent | >5,000 lines of output |
| Re-rendering on every diff line | Choppy diff scrolling | Batch diff updates, virtualize rendering | >1,000 changed lines |
| Spawning new git process per status check | High CPU, slow UI updates | Cache git status, poll every 500ms max | >5 worktrees or <200ms poll interval |
| Keeping all worktrees' git data in memory | High memory usage, slow startup | Load git data lazily when workspace activated | >10 worktrees |
| No output rate limiting | Terminal can't keep up | Throttle to terminal draw rate (~60 fps = ~16ms) | High-frequency output (logging libraries) |
| Synchronous diff calculation | UI freeze during diff | Calculate diff in background, show previous while updating | >100 changed files |
| Loading full file contents for diff | Memory spike | Stream file comparison, process in chunks | Files >10MB |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Spawning git commands with unsanitized branch names | Command injection (branch names can contain shell metacharacters) | Use git programmatic APIs or escape shell arguments with `shell-escape` package |
| Displaying raw agent output without sanitization | ANSI escape code injection (malicious sequences can rewrite terminal history or exfiltrate data) | Strip unknown escape codes, allowlist only colors and cursor movement |
| Storing GitHub tokens in worktree git config | Tokens committed to repository, visible in git log | Only store tokens in user's global git credential store, never in worktree |
| Following symlinks in worktree directories | Directory traversal, writing outside worktree | Use `fs.realpath()` to resolve symlinks, validate path is within worktree |
| Running `gh` commands with --repo from user input | Access to unauthorized repositories | Validate repository ownership before gh commands |
| Executing workspace-level git hooks | Arbitrary code execution from cloned repositories | Disable hooks for automated operations: `git --no-verify` or set `core.hooksPath=/dev/null` |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No visual indicator which pane has focus | Users type in wrong pane, get frustrated | Bold border or color change on focused pane |
| Using default Ink error messages | Generic "Error: Command failed", no actionable info | Custom error boundaries with context: "Git command failed in worktree 'feature-x': fatal: not a git repository" |
| Auto-scrolling diff while user is reading | Diff jumps away from what user was reading | Pause auto-scroll when user manually scrolls, resume on new activity |
| No indication that agent is "thinking" | Users think app froze | Show spinner, elapsed time, or partial output streaming |
| Terminal size too small for three panes | Layout breaks, panes overlap or disappear | Detect minimum size (120x30), show "terminal too small" message if smaller |
| Exiting loses all agent output | Users can't review what happened | Option to save session output to file before exit, or write summary to stderr |
| Same colors for stdout and stderr | Can't distinguish normal output from errors | Different colors (stdout: white, stderr: red/yellow) |
| No indication that worktree is busy | Users try to switch away during git operation, corrupt state | Show "🔒 locked" status on active worktree during operations |
| Unclear what keypresses do | Users mash random keys trying to do things | Show key hints at bottom: "Tab: switch pane | Ctrl-Q: quit | Ctrl-N: new workspace" |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Agent CLI pane:** Often missing PTY resize handling — verify output wraps correctly after terminal resize
- [ ] **Process cleanup:** Often missing SIGTERM/SIGINT handlers — verify `ps aux` shows no leftover processes after app exit (including crash)
- [ ] **Worktree switching:** Often missing path validation — verify switching to deleted worktree shows clear error, not crash
- [ ] **Diff viewer:** Often missing empty state — verify behavior when worktree has no changes (should show "no changes" message)
- [ ] **Focus management:** Often missing keyboard hints — verify users can discover how to switch focus without reading docs
- [ ] **Error handling:** Often missing specific error messages — verify git errors show full context (which worktree, which command, what to do)
- [ ] **Terminal state cleanup:** Often missing crash recovery — verify `kill -9` doesn't leave terminal in raw mode
- [ ] **Output history:** Often missing memory limits — verify app doesn't crash after agent outputs 100k lines
- [ ] **Git operations:** Often missing progress indication — verify long operations (clone, worktree add) show they're working
- [ ] **Multi-agent support:** Often missing race condition handling — verify simultaneous agent output in different panes doesn't corrupt display

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Zombie processes accumulated | LOW | 1. `ps aux \| grep "git\|gh\|claude\|code"` to find PIDs<br>2. `kill <pid>` for each<br>3. Add cleanup handlers to prevent recurrence |
| Terminal left in raw mode | LOW | User runs `reset` command or reopens terminal<br>Add exit handlers to prevent |
| Worktree path invalid in TUI | LOW | 1. Detect with `git worktree list --porcelain`<br>2. Offer "Remove from list" or "Relocate"<br>3. Run `git worktree repair` if moved<br>4. Run `git worktree prune` if deleted |
| Memory leak from diff watchers | MEDIUM | 1. Restart app (lost state)<br>2. Add ref cleanup in useEffect returns<br>3. Add memory monitoring in dev mode |
| PTY data race (lost output) | MEDIUM | 1. No automatic recovery - data is lost<br>2. Implement grace period buffering<br>3. Add sequence numbers for detection |
| stdout/stderr out of order | MEDIUM | 1. Can't fix retroactively<br>2. Switch to PTY for future<br>3. Add timestamps to help users debug |
| Focus stuck on component | LOW | 1. `useFocusManager` to enable/disable focus<br>2. Focus reset on Escape key<br>3. Add "force unfocus all" command |
| Alternate screen buffer corrupted | LOW | User runs `reset` or `clear`<br>Add explicit cleanup escape sequences |
| Git operation in wrong worktree | HIGH | 1. Hard to undo (commit in wrong branch, PR from wrong worktree)<br>2. User must manually fix git state<br>3. Prevent with explicit --git-dir validation |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Terminal state not restored | Phase 1: Basic TUI | Send SIGTERM, verify terminal usable; test `reset` not needed |
| Alternate screen buffer issues | Phase 1: Basic TUI | Exit app, verify terminal scroll history intact; test on Terminal.app, iTerm2, Alacritty |
| Focus management broken | Phase 3: Three-pane layout | Tab through panes, verify visual indicator matches stdin routing |
| Zombie processes | Phase 2: Agent integration | Crash app, verify `ps aux` clean; run 10 times, verify no accumulation |
| PTY resize not propagated | Phase 2: Agent integration | Start agent, resize terminal 50% smaller, verify agent output adapts |
| Process lifecycle race conditions | Phase 2: Agent integration | Run agent 100 times, verify final output lines always captured |
| stdout/stderr interleaving lost | Phase 2: Agent integration | Run command with interleaved streams, verify output order matches native terminal |
| Worktree path desync | Phase 2: Worktree management | Manually delete worktree directory, verify UI handles gracefully |
| Memory leak from diff watchers | Phase 4: Diff viewer | Switch worktrees 50 times, verify memory stable |
| Ink re-render performance | Phase 2: Agent integration | Stream 10k lines output, verify UI responsive; measure fps >30 |

---

## Sources

### Official Documentation & Repositories
- [Ink GitHub Repository](https://github.com/vadimdemedes/ink) - React for CLIs, focus management, input handling
- [Ink 3 Announcement](https://vadimdemedes.com/posts/ink-3) - Performance improvements and fixes
- [node-pty GitHub Issues](https://github.com/microsoft/node-pty/issues) - Process lifecycle issues, data race conditions
- [Node.js child_process documentation](https://nodejs.org/api/child_process.html) - Process spawning and management

### Known Issues & Bug Reports
- [node-pty Issue #72: Data events after exit](https://github.com/microsoft/node-pty/issues/72) - Critical race condition
- [Claude Code Issue #2734: stdout/stderr interleaving broken](https://github.com/anthropics/claude-code/issues/2734) - Output ordering problems
- [BubbleTea Issue #1455: Alternate screen broken in Terminal.app](https://github.com/charmbracelet/bubbletea/issues/1455) - Terminal compatibility
- [OpenCode TUI Crashes](https://github.com/sst/opencode/issues/4606) - Recent TUI crash patterns

### Best Practices & Guides
- [Building Terminal Interfaces with Node.js](https://blog.openreplay.com/building-terminal-interfaces-nodejs/) - Resize handling, raw mode
- [TUI Development: Ink + React](https://combray.prose.sh/2025-12-01-tui-development) - 2025 patterns and practices
- [Understanding Terminal Specifications for TUI Development](https://dev.to/bmf_san/understanding-terminal-specifications-to-help-with-tui-development-749) - Line discipline, signals
- [What Is a Zombie Process and How to Avoid It](https://saturncloud.io/blog/what-is-a-zombie-process-and-how-to-avoid-it-when-spawning-nodejs-child-processes-on-cloud-foundry/) - Process cleanup patterns

### Git Worktree Specific
- [Git Worktrees for Fun and Profit](https://blog.safia.rocks/2025/09/03/git-worktrees/) - Common issues and solutions
- [LazyWorktree](https://github.com/chmouel/lazyworktree) - TUI worktree manager patterns
- [git-worktree documentation](https://git-scm.com/docs/git-worktree) - Official reference

### Process Management & Performance
- [5 Tips for Cleaning Orphaned Node.js Processes](https://medium.com/@arunangshudas/5-tips-for-cleaning-orphaned-node-js-processes-196ceaa6d85e) - Cleanup strategies
- [terminate npm package](https://www.npmjs.com/package/terminate/v/2.5.0) - Process tree termination
- [React State Management 2025](https://www.developerway.com/posts/react-state-management-2025) - Race conditions and state patterns

### Terminal Control
- [Terminal control/Preserve screen - Rosetta Code](https://rosettacode.org/wiki/Terminal_control/Preserve_screen) - Alternate screen patterns
- [Alternate Screen Buffer in Ratatui](https://ratatui.rs/concepts/backends/alternate-screen/) - Terminal concepts
- [Build Your Own Text Editor - Entering Raw Mode](https://viewsourcecode.org/snaptoken/kilo/02.enteringRawMode.html) - Terminal state management

---

*Confidence Assessment: MEDIUM-HIGH*

**HIGH confidence areas:**
- Process lifecycle and cleanup issues (well-documented in node-pty issues)
- Terminal state management (standard patterns across TUI frameworks)
- Ink-specific pitfalls (official documentation and release notes)

**MEDIUM confidence areas:**
- Specific performance thresholds (depends on terminal emulator and hardware)
- Git worktree edge cases (newer feature, evolving tooling)
- Multi-agent race conditions (domain-specific, less documented)

**Research gaps:**
- Real-world performance profiling data for Ink with high-frequency updates
- Comprehensive testing across all major terminal emulators for alternate screen behavior
- Production battle-testing of complex focus management scenarios

**Validation needed in implementation:**
- Exact buffer sizes and timing for PTY data race prevention
- Memory leak patterns specific to combining Ink + node-pty + git operations
- Optimal batching intervals for different types of updates

---

*Pitfalls research for: TUI coding agent orchestration*
*Researched: 2026-02-02*
