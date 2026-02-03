// src/agents/types.ts
import type { BufferedPtyProcess } from '../processes/pty-manager.js';

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
 * Represents a running agent process.
 */
export interface AgentInstance {
  id: string;                     // Unique agent instance ID
  workspaceId: string;            // Links to Workspace
  workspacePath: string;          // Filesystem path (for restart)
  type: AgentType;                // Agent type
  pty: BufferedPtyProcess;        // PTY process handle
  status: 'running' | 'stopped' | 'error';  // Current status
  startedAt: string;              // ISO timestamp
  stoppedAt?: string;             // ISO timestamp (when stopped)
}

/**
 * Agent event callbacks.
 * Used during agent spawning to wire up event handlers.
 */
export interface AgentEvents {
  onData: (data: string) => void;              // Output data from agent
  onExit: (exitCode: number, signal?: number) => void;  // Agent exit
  onError?: (error: Error) => void;            // Optional error handler
}
