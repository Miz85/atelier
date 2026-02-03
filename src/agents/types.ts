// src/agents/types.ts

/**
 * Agent type enumeration.
 * Supported agent CLI tools.
 */
export type AgentType = 'claude' | 'opencode';

/**
 * Agent command mapping.
 * Maps agent type to actual CLI command.
 */
export const AgentCommand: Record<AgentType, string> = {
  claude: 'claude',
  opencode: 'opencode',
};

/**
 * Agent instance tracking.
 * Represents a running agent in a tmux session.
 */
export interface AgentInstance {
  id: string;                     // Unique agent instance ID
  workspaceId: string;            // Links to Workspace (also tmux session name)
  workspacePath: string;          // Filesystem path (for restart)
  type: AgentType;                // Agent type
  status: 'running' | 'stopped' | 'error';  // Current status
  startedAt: string;              // ISO timestamp
  stoppedAt?: string;             // ISO timestamp (when stopped)
}

/**
 * Agent event callbacks.
 * Kept for API compatibility, but not actively used with tmux.
 * tmux sessions handle their own I/O.
 */
export interface AgentEvents {
  onData?: (data: string) => void;              // Output data from agent
  onExit?: (exitCode: number, signal?: number) => void;  // Agent exit
  onError?: (error: Error) => void;             // Optional error handler
}
