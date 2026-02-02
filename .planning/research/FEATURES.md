# Feature Research

**Domain:** TUI-based coding agent orchestration tool
**Researched:** 2026-02-02
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Multi-pane layout** | Standard in all TUI dev tools (lazygit, k9s, htop) | MEDIUM | Ink provides flexbox layout via Yoga engine. Three-pane requirement specified: agent CLI, diff, terminal |
| **Keyboard navigation** | TUIs are keyboard-first by definition | MEDIUM | Ink provides `useInput` hook and `useFocusManager`. Common patterns: Tab/Shift+Tab cycle panes, arrow keys navigate within pane |
| **Help system (`?` key)** | Universal TUI convention for discovering shortcuts | LOW | Display modal/overlay with keybindings. Referenced in taskwarrior-tui, hackernews-TUI patterns |
| **Session persistence** | Users expect to resume work after disconnection | MEDIUM | Claude Code and tmux both provide this. Critical for long-running agent tasks |
| **Process status indicators** | Show agent state (idle, working, error) at a glance | LOW | Common in process managers (htop, k9s). Use color coding + symbols |
| **Workspace creation/switching** | Core workflow: create workspace = worktree + agent instance | HIGH | Combines git worktree management with process spawning. Worktrunk shows this pattern |
| **Workspace isolation** | Each workspace has own git worktree, agent, terminal | MEDIUM | Prevents agents from conflicting. Git worktrees provide file isolation naturally |
| **Diff viewing** | Must see what agent changed before accepting | MEDIUM | Split-view diff is table stakes (critique, delta, DiffLume). Syntax highlighting expected |
| **Agent output streaming** | Real-time visibility into agent progress | MEDIUM | Stream stdout/stderr from Claude Code CLI. Ink handles terminal rendering |
| **Terminal access per workspace** | Run commands in each workspace's context | MEDIUM | Spawn shell session bound to worktree directory. Like tmux pane management |
| **Error handling/display** | Show agent errors clearly without crashing TUI | LOW | Catch process errors, display in UI with context. Don't let agent crash orchestrator |
| **Basic workspace lifecycle** | Create, start, stop, delete workspace | MEDIUM | Standard CRUD operations. Delete must clean up worktree + processes |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not expected, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Agent comparison view** | See multiple agents' outputs side-by-side for same task | HIGH | Unique value: test prompt variations, compare Claude vs OpenCode on same problem |
| **Checkpoint/rewind system** | Save workspace state before agent changes, rollback if needed | MEDIUM | Claude Code has `--checkpoint` system. Extend to workspace level with git commits |
| **Task queue per workspace** | Queue multiple prompts to same agent sequentially | MEDIUM | Agent processes prompts one at a time. Queue visible in UI. Prevents concurrent conflicts |
| **Workspace templates** | Pre-configured workspace setups (e.g., "full-stack", "bug-fix") | LOW | JSON configs defining agent settings, directories, post-create hooks |
| **Agent handoff** | Transfer incomplete task from one agent to another | MEDIUM | Export conversation context, import to new agent. Useful when switching Claude→OpenCode |
| **Diff approval workflow** | Review/approve/reject changes before merging | MEDIUM | Stage changes incrementally. Accept file-by-file or hunk-by-hunk like lazygit |
| **Shared context across agents** | Multiple agents in same workspace see each other's changes | HIGH | Agents work on same worktree concurrently. Requires coordination to prevent conflicts |
| **Session recording/playback** | Record agent sessions for debugging/auditing | MEDIUM | Capture all agent I/O. Replay to reproduce issues. Valuable for learning/troubleshooting |
| **PR creation from workspace** | One-command flow: approve changes → create PR → link session | LOW | Integrate with `gh pr create`. Claude Code supports `--from-pr` to link sessions to PRs |
| **Resource limits per workspace** | Set max tokens, cost, time per agent session | LOW | Use Claude Code `--max-budget-usd`, `--max-turns` flags. Prevent runaway costs |
| **Live workspace dashboard** | Overview of all workspaces: status, cost, progress | LOW | Summary view showing all active/idle workspaces. Like k9s dashboard for Kubernetes pods |
| **Hot reload configuration** | Update agent settings without restarting workspace | MEDIUM | Watch config files, apply changes to running agents. Faster iteration on prompts |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Real-time collaboration** | "Multiple users editing same workspace simultaneously" | Introduces complexity: conflicts, auth, sync, network dependency. TUIs are local-first tools | Use PR workflow: agents work independently, merge via PRs. Share workspace configs instead |
| **Visual GUI fallback** | "Some users prefer GUI to TUI" | Splits development effort, dilutes focus. Different paradigms (mouse vs keyboard) | Focus on TUI excellence. Users who want GUI can use VS Code/browser tools |
| **Automatic merging of agent changes** | "Speed up workflow by auto-accepting changes" | Agents make mistakes. Auto-merge = no review = bugs in codebase | Always require human review step. Make approval fast, not automatic |
| **Unlimited workspace count** | "I want to test many approaches in parallel" | Resource exhaustion: each workspace = git worktree + agent process + terminal. System limits will hit | Enforce reasonable limit (e.g., 10 active workspaces). Prompt cleanup of old workspaces |
| **Full IDE integration** | "Embed full code editor in TUI" | TUIs excel at orchestration, not editing. Building editor duplicates existing tools poorly | Keep TUI focused on orchestration. Users edit in their preferred IDE, TUI shows diffs |
| **Built-in git operations beyond worktrees** | "Add commit, push, merge features" | Scope creep. Git CLIs and lazygit already excel at this | Focus on agent orchestration + worktree management. Use git/lazygit for complex git operations |
| **Cloud-hosted workspaces** | "Run agents on remote servers" | Adds infrastructure complexity, security concerns, costs. TUIs are lightweight local tools | Run TUI locally, manage local workspaces. If remote needed, use SSH + tmux (standard pattern) |
| **Agent memory across all workspaces** | "Let agents remember past conversations globally" | Privacy concerns, context bleeding, unpredictable behavior. Workspace isolation is a feature | Keep agent context per-workspace. Use workspace templates to share common setup |

## Feature Dependencies

```
Workspace Creation
    └──requires──> Git Worktree Management
                       └──requires──> Git Repo Detection

Process Management
    └──requires──> Agent CLI Detection (Claude Code, OpenCode)

Multi-pane Layout
    └──requires──> Keyboard Navigation
    └──requires──> Focus Management

Diff Viewing
    └──requires──> Process Management (agent must complete)
    └──enhances──> Diff Approval Workflow

Terminal Access
    └──requires──> Process Management
    └──requires──> Workspace Creation (terminal bound to worktree)

Session Persistence
    └──requires──> Workspace Lifecycle Management
    └──enhances──> Task Queue

PR Creation
    └──requires──> Diff Approval Workflow
    └──requires──> Git Worktree Management

Agent Comparison View
    └──requires──> Multi-workspace Support
    └──requires──> Diff Viewing

Checkpoint/Rewind
    └──requires──> Git Worktree Management
    └──conflicts──> Automatic Merging (anti-feature)
```

### Dependency Notes

- **Workspace Creation requires Git Worktree Management:** Cannot create isolated workspace without git worktree
- **Process Management requires Agent CLI Detection:** Must find Claude Code or OpenCode executable before spawning
- **Multi-pane Layout requires Keyboard Navigation + Focus Management:** Layout is useless without navigation
- **Terminal Access requires Workspace Creation:** Shell must be spawned in correct worktree directory context
- **PR Creation requires Diff Approval Workflow:** Don't create PRs with unapproved changes
- **Agent Comparison conflicts with Cloud-hosted workspaces:** Local multi-agent testing is simple; cloud multiplies complexity

## MVP Definition

### Launch With (v1.0)

Minimum viable product — what's needed to validate the concept.

- [x] **Workspace CRUD** — Create, list, delete workspaces (worktree + agent binding)
- [x] **Three-pane layout** — Agent output | Diff viewer | Terminal shell
- [x] **Keyboard navigation** — Tab between panes, arrow keys within pane, vim-style hjkl optional
- [x] **Agent process management** — Start/stop Claude Code or OpenCode CLI in workspace context
- [x] **Basic diff viewing** — Show git diff of worktree changes, syntax highlighting
- [x] **Help system** — Press `?` for keyboard shortcuts overlay
- [x] **Status indicators** — Show workspace state (idle, working, error, stopped)
- [x] **Terminal pane** — Spawn shell in worktree directory, send commands
- [x] **Session persistence** — Save/restore workspace list on restart

**Why these are essential:**
- Validates core value proposition: "orchestrate agents across isolated worktrees with live visibility"
- Provides complete workflow: create workspace → run agent → see changes → test manually → delete workspace
- Establishes TUI patterns that all future features build upon

### Add After Validation (v1.1 - v1.5)

Features to add once core is working and users provide feedback.

- [ ] **Diff approval workflow** (v1.1) — Accept/reject changes file-by-file before committing
- [ ] **PR creation integration** (v1.1) — Approved changes → `gh pr create` → link to session
- [ ] **Task queue** (v1.2) — Queue multiple prompts per agent, process sequentially
- [ ] **Workspace templates** (v1.2) — Save/load workspace configurations (agent settings, directories)
- [ ] **Resource limits** (v1.3) — Set max cost/tokens/time per workspace via CLI flags
- [ ] **Checkpoint system** (v1.3) — Save workspace state pre-change, rollback on demand
- [ ] **Live dashboard** (v1.4) — Overview of all workspaces with status/cost/progress summary
- [ ] **Agent comparison view** (v1.5) — Side-by-side output from multiple agents on same task

**Triggers for adding:**
- v1.1: Users request PR workflow integration (expected immediately)
- v1.2: Users report managing many concurrent tasks gets messy
- v1.3: Users concerned about runaway costs or want to experiment safely
- v1.4: Users with >5 workspaces request better overview
- v1.5: Users want to A/B test different agents/prompts

### Future Consideration (v2.0+)

Features to defer until product-market fit is established.

- [ ] **Agent handoff** — Why defer: Complex cross-agent context transfer. Wait for user demand signal
- [ ] **Session recording/playback** — Why defer: Non-critical debugging feature. Build when pain points emerge
- [ ] **Hot reload configuration** — Why defer: Nice-to-have DX improvement. Not blocking core workflows
- [ ] **Shared context across agents** — Why defer: High complexity, unclear value. Need validation of use case
- [ ] **Custom agent types beyond Claude/OpenCode** — Why defer: Focus on supported agents first. Extend API later
- [ ] **Workspace export/import** — Why defer: Sharing pattern unclear. Wait to see how teams actually collaborate
- [ ] **Advanced git operations** — Why defer: git/lazygit already handle this. Only add if clear gap identified

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Workspace CRUD | HIGH | MEDIUM | P1 |
| Three-pane layout | HIGH | MEDIUM | P1 |
| Agent process management | HIGH | MEDIUM | P1 |
| Keyboard navigation | HIGH | MEDIUM | P1 |
| Basic diff viewing | HIGH | MEDIUM | P1 |
| Status indicators | HIGH | LOW | P1 |
| Help system | HIGH | LOW | P1 |
| Terminal pane | HIGH | MEDIUM | P1 |
| Session persistence | MEDIUM | LOW | P1 |
| Diff approval workflow | HIGH | MEDIUM | P2 |
| PR creation integration | HIGH | LOW | P2 |
| Task queue | MEDIUM | MEDIUM | P2 |
| Workspace templates | MEDIUM | LOW | P2 |
| Resource limits | MEDIUM | LOW | P2 |
| Checkpoint system | MEDIUM | MEDIUM | P2 |
| Live dashboard | MEDIUM | LOW | P2 |
| Agent comparison view | MEDIUM | HIGH | P2 |
| Agent handoff | LOW | HIGH | P3 |
| Session recording | LOW | MEDIUM | P3 |
| Hot reload config | LOW | MEDIUM | P3 |
| Shared context | LOW | HIGH | P3 |

**Priority key:**
- **P1**: Must have for launch (MVP v1.0)
- **P2**: Should have, add when validated (v1.1-1.5)
- **P3**: Nice to have, future consideration (v2.0+)

## Competitor Feature Analysis

| Feature | Lazygit | K9s | Worktrunk | Claude Code CLI | Our Approach |
|---------|---------|-----|-----------|-----------------|--------------|
| **Multi-pane TUI** | Yes (branches, commits, files, stash) | Yes (resources, logs, events) | No (CLI only) | No (single REPL) | **Three-pane**: agent output, diff, terminal |
| **Keyboard shortcuts** | Extensive (stage, rebase, cherry-pick) | Extensive (k8s operations) | N/A | Basic (Ctrl+R history) | Minimal set for v1, expand based on usage patterns |
| **Help overlay (`?`)** | Yes | Yes | N/A | No | **Yes** — standard TUI pattern |
| **Session persistence** | No (ephemeral) | No (ephemeral) | No | Yes (resume by ID/PR) | **Yes** — save workspace list across restarts |
| **Process management** | Git operations only | Kubernetes pods | No | Single agent REPL | **Multi-agent** — multiple agents across workspaces |
| **Workspace isolation** | N/A (single repo) | Namespace-based | Yes (worktrees) | No (single directory) | **Yes** — worktree per workspace |
| **Diff viewing** | Yes (inline + split) | No | No | Changes shown in REPL | **Split-view** with syntax highlighting |
| **PR integration** | No | No | No | Yes (`--from-pr` flag) | **Yes** — one-command PR creation post-approval |
| **Task queue** | No | No | No | No | **Yes** — queue prompts per agent |
| **Resource limits** | N/A | Yes (k8s limits) | No | Yes (`--max-budget-usd`) | **Yes** — per-workspace cost/token limits |
| **Agent comparison** | N/A | N/A | No | No | **Unique differentiator** |

**Our competitive position:**
- **Borrows best from**: Lazygit (TUI UX patterns), K9s (multi-resource management), Claude Code (agent features)
- **Fills gap**: No existing tool orchestrates multiple AI agents with live TUI visibility
- **Differentiator**: Agent comparison view enables prompt engineering and A/B testing workflows

## Implementation Notes for Roadmap

### Phase 1 (Foundation): Core TUI + Single Workspace
- Focus: Get three-pane layout working with one workspace
- Complexity: Medium (Ink learning curve + git worktree integration)
- Derisks: TUI framework choice, basic architecture

### Phase 2 (Multi-Workspace): Workspace Management
- Focus: CRUD for workspaces, status tracking, navigation
- Complexity: Medium (state management across workspaces)
- Derisks: Scaling beyond one workspace

### Phase 3 (Agent Integration): Process Spawning + Streaming
- Focus: Start Claude Code/OpenCode, stream output to TUI
- Complexity: Medium (subprocess management, stdio handling)
- Derisks: Agent CLI integration

### Phase 4 (Diff + Approval): Review Workflow
- Focus: Diff viewing with syntax highlighting, approve/reject UI
- Complexity: Medium (diff parsing, file selection)
- Unlocks: PR creation (cannot create PR without approval)

### Phase 5 (PR Integration): GitHub Workflow
- Focus: Create PRs from approved changes, link sessions
- Complexity: Low (wrap `gh` CLI)
- High value: Completes end-to-end workflow

### Phase 6 (Polish + Expansion): Dashboard, Queue, Comparison
- Focus: Multi-workspace dashboard, task queue, agent comparison
- Complexity: Medium-High (depends on features selected)
- Validates: Product-market fit for advanced features

## Sources

**TUI Development Patterns:**
- [Ink React TUI Framework](https://github.com/vadimdemedes/ink) — Core layout, keyboard, focus system (HIGH confidence)
- [Lazygit](https://github.com/jesseduffield/lazygit) — Multi-pane navigation, keyboard UX patterns (HIGH confidence)
- [K9s Kubernetes TUI](https://github.com/derailed/k9s) — Process management dashboard patterns (MEDIUM confidence)
- [Terminal Trove TUI Collection](https://terminaltrove.com/categories/tui/) — TUI ecosystem survey (MEDIUM confidence)

**Coding Agent Tools:**
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) — Agent features, flags, session management (HIGH confidence)
- [Claude Flow](https://github.com/ruvnet/claude-flow) — Multi-agent orchestration patterns (MEDIUM confidence, GitHub source)
- [AI Agent Orchestration Frameworks 2026](https://research.aimultiple.com/agentic-orchestration/) — Industry landscape (MEDIUM confidence)

**Git Worktree Management:**
- [Worktrunk CLI](https://github.com/max-sixty/worktrunk) — Worktree management for parallel AI workflows (HIGH confidence, GitHub source)
- [Git Worktree Toolbox](https://github.com/ben-rogerson/git-worktree-toolbox) — Agent-worktree integration patterns (MEDIUM confidence)
- [gwq Fuzzy Finder](https://github.com/d-kuro/gwq) — Worktree selection UX (MEDIUM confidence)

**Diff Viewers:**
- [Critique TUI](https://github.com/remorses/critique) — Split-view diff patterns (MEDIUM confidence, GitHub source)
- [DiffLume](https://github.com/yakimka/DiffLume) — Three-panel diff architecture (MEDIUM confidence, GitHub source)

**Terminal Multiplexing:**
- [tmux Manual](https://man7.org/linux/man-pages/man1/tmux.1.html) — Session persistence patterns (HIGH confidence)
- [tmux Guide 2026](https://www.hostinger.com/tutorials/how-to-use-tmux) — Modern tmux features (MEDIUM confidence)

**PR Management:**
- [GitHub CLI (gh)](https://cli.github.com/manual/gh_pr_create) — PR creation API (HIGH confidence)
- [Stack-PR Tool](https://www.modular.com/blog/announcing-stack-pr-an-open-source-tool-for-managing-stacked-prs-on-github) — Stacked PR patterns (MEDIUM confidence)

---
*Feature research for: equipe — TUI for orchestrating coding agents*
*Researched: 2026-02-02*
*Confidence: HIGH (verified with official docs + GitHub sources)*
