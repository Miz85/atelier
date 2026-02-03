---
phase: 03
plan: 04
subsystem: agent-integration
completed: 2026-02-03
duration: 2.6 min

tags: [ui, agent-lifecycle, keyboard-nav, real-time]

requires:
  - 03-01  # Agent spawn/stop/restart functions
  - 03-02  # Agent state atoms and action atoms
  - 03-03  # AgentOutput and AgentControls components

provides:
  - AgentView component combining output and controls
  - Agent override option in workspace creation (AGENT-07)
  - Full agent lifecycle UI in main app
  - Real-time streaming output display
  - Input mode for sending commands to agent

affects:
  - 04-*   # Phase 4 can now use complete agent integration

tech-stack:
  added: []
  patterns:
    - "Jotai action atoms for event callbacks"
    - "PTY event wiring to state updates"
    - "Keyboard navigation with mode switching"

key-files:
  created:
    - src/components/AgentView.tsx
  modified:
    - src/components/CreateWorkspace.tsx
    - src/app.tsx

decisions:
  - id: agent-override-tab-cycle
    choice: "Tab key cycles through agent options in CreateWorkspace"
    rationale: "Simple single-key interaction, consistent with keyboard-first design"
    impact: "Easy agent selection without leaving keyboard"

  - id: idle-status-mapping
    choice: "Map 'idle' status to 'stopped' for AgentControls"
    rationale: "AgentControls expects running/stopped/error, idle is effectively stopped"
    impact: "Simplifies status display without changing state model"

  - id: input-mode-indicator
    choice: "Separate input mode with TextInput for agent commands"
    rationale: "Clean separation between viewing output and sending input"
    impact: "User must press 'i' to enter input mode, press Esc to exit"
---

# Phase 03 Plan 04: Agent Integration Completion Summary

**One-liner:** Complete agent UI integration with real-time output streaming, lifecycle controls, and agent override in workspace creation

## What Was Built

### 1. AgentView Component
Created `src/components/AgentView.tsx` that combines all agent functionality:
- Real-time output streaming via PTY onData callbacks
- Agent lifecycle controls (start/stop/restart)
- Input mode for sending commands to running agent
- Keyboard shortcuts: 'i' for input, 'q' to exit
- Integrates AgentOutput and AgentControls components

**Key implementation details:**
- Wires `spawnAgent`/`restartAgent`/`sendInput` to Jotai action atoms
- onData callback splits PTY output into lines and appends to state
- onExit callback updates status based on exit code
- Handles 'idle' status by mapping to 'stopped' for controls
- Input mode uses TextInput component for command entry

### 2. Agent Override in Workspace Creation
Modified `src/components/CreateWorkspace.tsx` to allow agent type selection:
- Added `agentOverride` state tracking selected agent
- Tab key cycles: default → claude → opencode → default
- Visual indicator shows: `Agent: [claude] opencode (default: claude)`
- Passes selected agent to createWorkspace function
- Fulfills AGENT-07 requirement

### 3. Main App Integration
Modified `src/app.tsx` to wire AgentView into navigation:
- Added 'agent-view' to Screen type union
- 'a' keyboard shortcut opens agent view (when workspace active)
- Help text conditionally shows "a: agent view"
- Guards against missing workspace with null check

## Verification Results

All verification criteria passed:

✅ Build succeeds: `npm run build` - No errors
✅ Create workspace shows agent selection with Tab cycling
✅ Main screen shows 'a: agent view' when workspace active
✅ Agent view displays output area and controls
✅ All TypeScript types compile correctly

## Success Criteria Met

All success criteria achieved:

✅ User can create workspace with agent override (AGENT-07)
✅ User can access agent view from main screen
✅ User can see streaming output (AGENT-02)
✅ User can stop running agent (AGENT-04)
✅ User can restart stopped agent (AGENT-05)
✅ User can send input to agent (AGENT-03)
✅ All keyboard shortcuts work correctly
✅ Build completes without errors

## Implementation Notes

### PTY Event Wiring
The AgentView component demonstrates clean event callback wiring:
```typescript
const instance = spawnAgent(workspace.id, workspace.path, workspace.agent, {
  onData: (data) => {
    const lines = data.split('\n').filter(line => line.trim());
    lines.forEach(line => appendOutput({ workspaceId, line }));
  },
  onExit: (exitCode, signal) => {
    const status = exitCode === 0 ? 'stopped' : 'error';
    setStatus({ workspaceId, status, error: ... });
  }
});
```

This pattern keeps the PTY process layer separate from Jotai state management.

### Agent Override UX
The Tab-based agent selection provides a clean keyboard-first interaction:
- No separate modal or form field required
- Visual feedback shows all options and current selection
- Falls back to default if user doesn't override

### Input Mode Pattern
Separating input mode from output viewing prevents accidental input:
- User must explicitly press 'i' to enter input mode
- Input is sent with Enter, mode exits after submission
- Esc cancels input mode without sending

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

**Phase 3 (Agent Integration) is now complete.**

All agent functionality is integrated and working:
- ✅ Agent spawning and process management (03-01)
- ✅ Agent state management with Jotai (03-02)
- ✅ Agent UI components (03-03)
- ✅ Full agent lifecycle in main app (03-04)

**Ready for Phase 4:**
Phase 4 can now build on complete agent integration for:
- Advanced agent features (e.g., persistence, logs, metrics)
- IDE integration with agent context
- Multi-agent coordination
- Performance optimizations

**No blockers.** All must-have requirements fulfilled.

## Technical Debt

None introduced in this plan.

## Commits

| Hash    | Message                                            | Files                              |
|---------|----------------------------------------------------|------------------------------------|
| 5086352 | feat(03-04): create AgentView component            | src/components/AgentView.tsx       |
| 75c0b2b | feat(03-04): add agent override to workspace creation | src/components/CreateWorkspace.tsx |
| 0b2d5a3 | feat(03-04): wire AgentView into main app          | src/app.tsx                        |
