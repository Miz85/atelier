// src/agents/spawn.ts
import { BufferedPtyProcess } from '../processes/pty-manager.js';
import { AgentType, AgentCommand, AgentInstance, AgentEvents } from './types.js';

/**
 * In-memory registry of all agent instances.
 * Maps agent ID to AgentInstance.
 */
const agentInstances = new Map<string, AgentInstance>();

/**
 * Spawn a new agent process in a workspace directory.
 *
 * @param workspaceId - Workspace identifier
 * @param workspacePath - Filesystem path to workspace (PTY cwd)
 * @param agentType - Agent type to spawn ('claude' or 'opencode')
 * @param events - Event callbacks for output/exit
 * @returns AgentInstance with PTY handle and metadata
 */
export function spawnAgent(
  workspaceId: string,
  workspacePath: string,
  agentType: AgentType,
  events: AgentEvents
): AgentInstance {
  // Generate unique agent ID
  const agentId = `agent-${workspaceId}-${Date.now()}`;

  // Look up CLI command
  const command = AgentCommand[agentType];

  // Spawn PTY process
  const pty = new BufferedPtyProcess({
    command,
    args: [],
    cwd: workspacePath,
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 30,
  });

  // Create agent instance
  const instance: AgentInstance = {
    id: agentId,
    workspaceId,
    workspacePath,
    type: agentType,
    pty,
    status: 'running',
    startedAt: new Date().toISOString(),
  };

  // Wire up event handlers
  pty.on({
    onData: events.onData,
    onExit: (exitCode, signal) => {
      // Update instance status
      instance.status = 'stopped';
      instance.stoppedAt = new Date().toISOString();

      // Call user's exit handler
      events.onExit(exitCode, signal);
    },
  });

  // Track instance
  agentInstances.set(agentId, instance);

  return instance;
}

/**
 * Stop a running agent.
 * Sends SIGTERM, waits 5 seconds, then sends SIGKILL if needed.
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

  // Send SIGTERM
  instance.pty.kill('SIGTERM');

  // Wait for graceful exit (up to 5 seconds)
  const exitPromise = new Promise<void>((resolve) => {
    if (instance.pty.hasExited) {
      resolve();
      return;
    }

    const checkInterval = setInterval(() => {
      if (instance.pty.hasExited) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 100);

    // Timeout after 5 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve();
    }, 5000);
  });

  await exitPromise;

  // Force kill if still running
  if (!instance.pty.hasExited) {
    console.log(`[Agent ${agentId}] SIGTERM timeout, sending SIGKILL`);
    instance.pty.kill('SIGKILL');
  }

  // Update status
  instance.status = 'stopped';
  instance.stoppedAt = new Date().toISOString();
}

/**
 * Restart an agent (stop and spawn new instance).
 * Agent must be stopped first.
 *
 * @param agentId - Agent instance ID to restart
 * @param events - Event callbacks for new instance
 * @returns New AgentInstance
 * @throws Error if agent not found or still running
 */
export function restartAgent(
  agentId: string,
  events: AgentEvents
): AgentInstance {
  const oldInstance = agentInstances.get(agentId);
  if (!oldInstance) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  if (oldInstance.status === 'running') {
    throw new Error(`Agent is still running: ${agentId}. Call stopAgent() first.`);
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
 * Send input to agent's stdin.
 * Note: PTY requires \r (carriage return) for Enter, not \n.
 *
 * @param agentId - Agent instance ID
 * @param input - Text to send (will append \r automatically)
 * @throws Error if agent not found or not running
 */
export function sendInput(agentId: string, input: string): void {
  const instance = agentInstances.get(agentId);
  if (!instance) {
    throw new Error(`Agent not found: ${agentId}`);
  }

  if (instance.status !== 'running') {
    throw new Error(`Agent is not running: ${agentId}`);
  }

  // PTY requires \r for Enter key
  instance.pty.write(input + '\r');
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
