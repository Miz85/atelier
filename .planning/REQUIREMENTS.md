# Requirements: equipe

**Defined:** 2026-02-02
**Core Value:** Quickly spin up and switch between isolated coding agent workspaces without losing context or stepping on each other's work

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Workspace Management

- [ ] **WORK-01**: User can create workspace with branch name (creates git worktree + launches agent)
- [ ] **WORK-02**: User can delete workspace (removes worktree, kills agent process)
- [ ] **WORK-03**: User can list all workspaces with repo and branch info
- [ ] **WORK-04**: User can switch between workspaces

### Agent Integration

- [ ] **AGENT-01**: User can spawn Claude Code or OpenCode in a workspace
- [ ] **AGENT-02**: User can view agent output in real-time (streaming)
- [ ] **AGENT-03**: User can send input to agent (interactive conversation)
- [ ] **AGENT-04**: User can stop a running agent
- [ ] **AGENT-05**: User can restart a stopped agent
- [ ] **AGENT-06**: User can configure default agent in settings (Claude Code or OpenCode)
- [ ] **AGENT-07**: User can override default agent when creating workspace

### UI/Navigation

- [ ] **UI-01**: App displays three-pane layout (agent output | diff summary | terminal)
- [ ] **UI-02**: User can navigate between panes with Tab key
- [ ] **UI-03**: User can view keyboard shortcuts with ? key
- [ ] **UI-04**: App persists workspace state across restarts
- [ ] **UI-05**: App restores active workspaces on launch

### Git/GitHub Integration

- [ ] **GIT-01**: User can view diff of changes made by agent in workspace
- [ ] **GIT-02**: User can open workspace directory in IDE via configurable command
- [ ] **GIT-03**: User can see if branch has open PR (shows status indicator)
- [ ] **GIT-04**: User can open PR link in browser from workspace
- [ ] **GIT-05**: User can create PR from workspace

### Configuration

- [ ] **CONF-01**: User can configure IDE command in settings
- [ ] **CONF-02**: User can configure default agent in settings

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Workspace Management

- **WORK-05**: User can set resource limits per workspace (max tokens/cost)
- **WORK-06**: User can create workspace from template

### Agent Integration

- **AGENT-08**: User can compare outputs from different agents on same task
- **AGENT-09**: User can queue multiple tasks for sequential execution

### UI/Navigation

- **UI-06**: User can navigate with vim-style keys (hjkl)
- **UI-07**: User can view dashboard of all workspaces (status, progress)

### Git/GitHub Integration

- **GIT-06**: User can approve/reject changes per file before PR
- **GIT-07**: User can checkpoint workspace state and rewind to previous checkpoint

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Real-time collaboration | Adds auth/sync/network complexity, dilutes focus |
| Automatic merging of agent changes | Agents make mistakes, review is essential |
| Visual GUI fallback | Splits development effort, different paradigm |
| Built-in git operations beyond worktrees | Scope creep, lazygit handles this |
| Non-GitHub PR integration | GitHub-first via gh CLI, other forges later |
| Multi-repo support | Single repo focus for v1, expand later |
| Agent handoff between agents | Complex, unclear demand |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WORK-01 | TBD | Pending |
| WORK-02 | TBD | Pending |
| WORK-03 | TBD | Pending |
| WORK-04 | TBD | Pending |
| AGENT-01 | TBD | Pending |
| AGENT-02 | TBD | Pending |
| AGENT-03 | TBD | Pending |
| AGENT-04 | TBD | Pending |
| AGENT-05 | TBD | Pending |
| AGENT-06 | TBD | Pending |
| AGENT-07 | TBD | Pending |
| UI-01 | TBD | Pending |
| UI-02 | TBD | Pending |
| UI-03 | TBD | Pending |
| UI-04 | TBD | Pending |
| UI-05 | TBD | Pending |
| GIT-01 | TBD | Pending |
| GIT-02 | TBD | Pending |
| GIT-03 | TBD | Pending |
| GIT-04 | TBD | Pending |
| GIT-05 | TBD | Pending |
| CONF-01 | TBD | Pending |
| CONF-02 | TBD | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 0
- Unmapped: 23 ⚠️

---
*Requirements defined: 2026-02-02*
*Last updated: 2026-02-02 after initial definition*
