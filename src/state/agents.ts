// src/state/agents.ts
import { atom } from 'jotai';

/**
 * Agent status enumeration.
 * Represents the current state of an agent process.
 */
export type AgentStatus = 'idle' | 'running' | 'stopped' | 'error';

/**
 * Per-workspace agent state.
 * Tracks agent process status, output, and errors for a single workspace.
 */
export interface WorkspaceAgentState {
  agentId: string | null;           // Agent instance ID (null if no agent)
  status: AgentStatus;              // Current agent status
  outputLines: string[];            // Terminal output lines (capped at 1000)
  error?: string;                   // Error message (if status is 'error')
}

/**
 * Global agent state atom.
 * Maps workspace ID to agent state.
 * NOTE: This is ephemeral state, NOT persisted to disk.
 */
export const agentStateByWorkspaceAtom = atom<Map<string, WorkspaceAgentState>>(new Map());

/**
 * Get agent state for a specific workspace.
 * Returns a read-only derived atom for a single workspace's agent state.
 *
 * @param workspaceId - Workspace identifier
 * @returns Atom containing workspace agent state
 */
export function getWorkspaceAgentStateAtom(workspaceId: string) {
  return atom((get) => {
    const allStates = get(agentStateByWorkspaceAtom);
    return allStates.get(workspaceId) ?? {
      agentId: null,
      status: 'idle' as AgentStatus,
      outputLines: [],
    };
  });
}

/**
 * Action atom: Initialize agent state for a workspace.
 * Creates empty state if it doesn't exist.
 */
export const initAgentStateAtom = atom(
  null,
  (get, set, { workspaceId, agentId }: { workspaceId: string; agentId: string }) => {
    const states = new Map(get(agentStateByWorkspaceAtom));

    states.set(workspaceId, {
      agentId,
      status: 'running',
      outputLines: [],
    });

    set(agentStateByWorkspaceAtom, states);
  }
);

/**
 * Action atom: Append output line to agent state.
 * Automatically caps outputLines at 1000 (removes oldest).
 */
export const appendOutputAtom = atom(
  null,
  (get, set, { workspaceId, line }: { workspaceId: string; line: string }) => {
    const states = new Map(get(agentStateByWorkspaceAtom));
    const currentState = states.get(workspaceId);

    if (!currentState) {
      // No state exists, ignore (agent not initialized)
      return;
    }

    // Append line and cap at 1000
    const newOutputLines = [...currentState.outputLines, line];
    if (newOutputLines.length > 1000) {
      newOutputLines.shift(); // Remove oldest line
    }

    states.set(workspaceId, {
      ...currentState,
      outputLines: newOutputLines,
    });

    set(agentStateByWorkspaceAtom, states);
  }
);

/**
 * Action atom: Set agent status.
 * Updates status and optionally sets error message.
 */
export const setStatusAtom = atom(
  null,
  (get, set, { workspaceId, status, error }: { workspaceId: string; status: AgentStatus; error?: string }) => {
    const states = new Map(get(agentStateByWorkspaceAtom));
    const currentState = states.get(workspaceId);

    if (!currentState) {
      // No state exists, ignore (agent not initialized)
      return;
    }

    states.set(workspaceId, {
      ...currentState,
      status,
      error,
    });

    set(agentStateByWorkspaceAtom, states);
  }
);

/**
 * Action atom: Clear output for a workspace.
 * Resets outputLines to empty array.
 */
export const clearOutputAtom = atom(
  null,
  (get, set, workspaceId: string) => {
    const states = new Map(get(agentStateByWorkspaceAtom));
    const currentState = states.get(workspaceId);

    if (!currentState) {
      // No state exists, ignore (agent not initialized)
      return;
    }

    states.set(workspaceId, {
      ...currentState,
      outputLines: [],
    });

    set(agentStateByWorkspaceAtom, states);
  }
);
