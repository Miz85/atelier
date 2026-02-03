// src/agents/spawn.ts
// Agent lifecycle management using tmux sessions.

import { AgentType, AgentCommand, AgentInstance, AgentEvents } from './types.js';
import {
  createSession,
  killSession,
  hasSession,
  getSessionStatus,
  attachSession,
  capturePane,
  resizeSession,
} from './tmux.js';

/**
 * In-memory registry of all agent instances.
 * Maps agent ID to AgentInstance.
 */
const agentInstances = new Map<string, AgentInstance>();

/**
 * Spawn a new agent process in a workspace directory.
 * Creates a tmux session and runs the agent command inside it.
 *
 * @param workspaceId - Workspace identifier (used as tmux session name)
 * @param workspacePath - Filesystem path to workspace
 * @param agentType - Agent type to spawn ('claude' or 'opencode')
 * @param _events - Event callbacks (kept for API compatibility, not used with tmux)
 * @returns AgentInstance with metadata
 */
export function spawnAgent(
  workspaceId: string,
  workspacePath: string,
  agentType: AgentType,
  _events?: AgentEvents
): AgentInstance {
  // Generate unique agent ID
  const agentId = `agent-${workspaceId}-${Date.now()}`;

  // Get CLI command for agent type
  const command = AgentCommand[agentType];

  // Create tmux session with the agent command
  createSession(workspaceId, workspacePath, command);

  // Create agent instance
  const instance: AgentInstance = {
    id: agentId,
    workspaceId,
    workspacePath,
    type: agentType,
    status: 'running',
    startedAt: new Date().toISOString(),
  };

  // Track instance
  agentInstances.set(agentId, instance);

  return instance;
}

/**
 * Stop a running agent.
 * Kills the tmux session.
 *
 * @param agentId - Agent instance ID
 * @throws Error if agent not found
 */
export async function stopAgent(agentId: string): Promise<void> {
  const instance = agentInstances.get(agentId);
  if (!instance) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  // Already stopped
  if (instance.status === 'stopped') {
    return;
  }

  // Kill tmux session
  killSession(instance.workspaceId);

  // Update status
  instance.status = 'stopped';
  instance.stoppedAt = new Date().toISOString();
}

/**
 * Restart an agent (stop and spawn new instance).
 *
 * @param agentId - Agent instance ID to restart
 * @param events - Event callbacks for new instance
 * @returns New AgentInstance
 * @throws Error if agent not found
 */
export function restartAgent(
  agentId: string,
  events?: AgentEvents
): AgentInstance {
  const oldInstance = agentInstances.get(agentId);
  if (!oldInstance) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  // Kill old session if still running
  if (hasSession(oldInstance.workspaceId)) {
    killSession(oldInstance.workspaceId);
  }

  // Remove old instance
  agentInstances.delete(agentId);

  // Spawn new agent with same workspace/type
  const newInstance = spawnAgent(
    oldInstance.workspaceId,
    oldInstance.workspacePath,
    oldInstance.type,
    events
  );

  return newInstance;
}

/**
 * Attach to an agent's tmux session.
 * This gives the user full terminal control.
 * User detaches with Ctrl+B D to return.
 *
 * @param agentId - Agent instance ID
 * @throws Error if agent not found or not running
 */
export function attachToAgent(agentId: string): void {
  const instance = agentInstances.get(agentId);
  if (!instance) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  if (!hasSession(instance.workspaceId)) {
    throw new Error(`Agent session not running: ${agentId}`);
  }

  // Resize session to match current terminal before attaching
  resizeSession(instance.workspaceId);

  // Attach to tmux session (blocks until user detaches)
  attachSession(instance.workspaceId);

  // After detach, check if session is still running
  // (user may have exited the agent)
  if (!hasSession(instance.workspaceId)) {
    instance.status = 'stopped';
    instance.stoppedAt = new Date().toISOString();
  }
}

/**
 * Get current output from agent's tmux session.
 * Captures the visible terminal content.
 *
 * @param agentId - Agent instance ID
 * @param lines - Number of lines to capture (default: 50)
 * @returns Captured output string
 */
export function getAgentOutput(agentId: string, lines: number = 50): string {
  const instance = agentInstances.get(agentId);
  if (!instance) {
    return '';
  }

  return capturePane(instance.workspaceId, lines);
}

/**
 * Check and update agent status from tmux.
 * Call this to sync instance status with actual tmux session state.
 *
 * @param agentId - Agent instance ID
 */
export function syncAgentStatus(agentId: string): void {
  const instance = agentInstances.get(agentId);
  if (!instance) return;

  const tmuxStatus = getSessionStatus(instance.workspaceId);

  if (tmuxStatus === 'stopped' && instance.status === 'running') {
    instance.status = 'stopped';
    instance.stoppedAt = new Date().toISOString();
  }
}

/**
 * Get agent instance by ID.
 *
 * @param agentId - Agent instance ID
 * @returns AgentInstance or undefined if not found
 */
export function getAgentInstance(agentId: string): AgentInstance | undefined {
  return agentInstances.get(agentId);
}

/**
 * Get agent instance by workspace ID.
 * Returns the first agent found for the workspace.
 *
 * @param workspaceId - Workspace identifier
 * @returns AgentInstance or undefined if not found
 */
export function getAgentByWorkspace(workspaceId: string): AgentInstance | undefined {
  for (const instance of agentInstances.values()) {
    if (instance.workspaceId === workspaceId) {
      return instance;
    }
  }
  return undefined;
}
