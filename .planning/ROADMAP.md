# Roadmap: equipe

## Overview

Build a terminal UI for orchestrating coding agents across isolated git worktrees. Start with foundation (process management, state, configuration), add workspace and agent operations, layer on UI components, then complete with git diff viewing and PR integration. Each phase delivers one complete, verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - Core infrastructure with process management and state persistence
- [ ] **Phase 2: Workspace Management** - Create and manage isolated git worktrees
- [ ] **Phase 3: Agent Integration** - Spawn and interact with coding agents
- [ ] **Phase 4: UI/Navigation** - Three-pane interface with keyboard navigation
- [ ] **Phase 5: Git Integration** - Diff viewing, IDE integration, and PR management

## Phase Details

### Phase 1: Foundation
**Goal**: Core infrastructure works reliably with process lifecycle, state management, and configuration
**Depends on**: Nothing (first phase)
**Requirements**: CONF-01, CONF-02, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. User can configure default agent and IDE command in settings
  2. App persists workspace state across restarts
  3. App restores active workspaces on launch
  4. Terminal remains usable after app crashes (no raw mode corruption)
  5. All spawned processes clean up properly on exit (no zombies)
**Plans**: TBD

Plans:
- [ ] TBD

### Phase 2: Workspace Management
**Goal**: Users can create and manage isolated workspaces with git worktrees
**Depends on**: Phase 1
**Requirements**: WORK-01, WORK-02, WORK-03, WORK-04
**Success Criteria** (what must be TRUE):
  1. User can create workspace with branch name (creates git worktree + agent)
  2. User can delete workspace (removes worktree, kills agent process)
  3. User can list all workspaces showing repo and branch info
  4. User can switch between workspaces
  5. Git worktree state stays synchronized with app state
**Plans**: TBD

Plans:
- [ ] TBD

### Phase 3: Agent Integration
**Goal**: Users can spawn and interact with coding agents in workspaces
**Depends on**: Phase 2
**Requirements**: AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05, AGENT-06, AGENT-07
**Success Criteria** (what must be TRUE):
  1. User can spawn Claude Code or OpenCode in a workspace
  2. User can view agent output in real-time (streaming)
  3. User can send input to agent (interactive conversation)
  4. User can stop a running agent
  5. User can restart a stopped agent
  6. User can override default agent when creating workspace
**Plans**: TBD

Plans:
- [ ] TBD

### Phase 4: UI/Navigation
**Goal**: Users can navigate three-pane interface with keyboard
**Depends on**: Phase 3
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. App displays three-pane layout (agent output | diff summary | terminal)
  2. User can navigate between panes with Tab key
  3. User can view keyboard shortcuts with ? key
  4. Focus indicator matches actual input routing (no stuck focus)
  5. UI remains responsive when agent outputs thousands of lines
**Plans**: TBD

Plans:
- [ ] TBD

### Phase 5: Git Integration
**Goal**: Users can review changes and manage PRs from workspaces
**Depends on**: Phase 4
**Requirements**: GIT-01, GIT-02, GIT-03, GIT-04, GIT-05
**Success Criteria** (what must be TRUE):
  1. User can view diff of changes made by agent in workspace
  2. User can open workspace directory in IDE via configured command
  3. User can see if branch has open PR (shows status indicator)
  4. User can open PR link in browser from workspace
  5. User can create PR from workspace
**Plans**: TBD

Plans:
- [ ] TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. Workspace Management | 0/TBD | Not started | - |
| 3. Agent Integration | 0/TBD | Not started | - |
| 4. UI/Navigation | 0/TBD | Not started | - |
| 5. Git Integration | 0/TBD | Not started | - |
