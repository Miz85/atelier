// src/components/AgentView.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { useAtom, useSetAtom } from 'jotai';
import { AgentControls } from './AgentControls.js';
import {
  spawnAgent,
  stopAgent,
  restartAgent,
  attachToAgent,
  getAgentOutput,
  syncAgentStatus,
  getAgentInstance,
} from '../agents/spawn.js';
import {
  getWorkspaceAgentStateAtom,
  initAgentStateAtom,
  setStatusAtom,
} from '../state/agents.js';
import type { Workspace } from '../state/workspace.js';

interface AgentViewProps {
  workspace: Workspace;
  onBack: () => void;
}

export function AgentView({ workspace, onBack }: AgentViewProps) {
  const { exit } = useApp();

  // Agent state for this workspace
  const workspaceAgentStateAtom = getWorkspaceAgentStateAtom(workspace.id);
  const [agentState] = useAtom(workspaceAgentStateAtom);

  // Action atoms
  const initAgentState = useSetAtom(initAgentStateAtom);
  const setStatus = useSetAtom(setStatusAtom);

  // UI state
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<string | null>(null);
  const [outputPreview, setOutputPreview] = useState<string[]>([]);
  const [attaching, setAttaching] = useState(false);

  // Derived status for controls (map 'idle' to 'stopped')
  const controlStatus = agentState.status === 'idle' ? 'stopped' : agentState.status;

  // Periodically sync status and fetch output preview
  useEffect(() => {
    if (!agentState.agentId) return;

    const interval = setInterval(() => {
      // Sync status from tmux
      syncAgentStatus(agentState.agentId!);

      // Check if status changed
      const instance = getAgentInstance(agentState.agentId!);
      if (instance && instance.status !== agentState.status) {
        setStatus({
          workspaceId: workspace.id,
          status: instance.status,
        });
      }

      // Update output preview
      if (instance?.status === 'running') {
        const output = getAgentOutput(agentState.agentId!, 20);
        const lines = output.split('\n').filter(line => line.trim());
        setOutputPreview(lines.slice(-10)); // Last 10 non-empty lines
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [agentState.agentId, agentState.status, workspace.id, setStatus]);

  // Handle agent spawn
  const handleStart = () => {
    setLoading(true);
    setOperation('Starting');
    try {
      const instance = spawnAgent(
        workspace.id,
        workspace.path,
        workspace.agent
      );

      // Initialize agent state in Jotai
      initAgentState({ workspaceId: workspace.id, agentId: instance.id });
    } catch (err) {
      setStatus({
        workspaceId: workspace.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
      setOperation(null);
    }
  };

  // Handle agent stop
  const handleStop = async () => {
    if (!agentState.agentId) return;

    setLoading(true);
    setOperation('Stopping');
    try {
      await stopAgent(agentState.agentId);
      setStatus({
        workspaceId: workspace.id,
        status: 'stopped',
      });
      setOutputPreview([]);
    } catch (err) {
      setStatus({
        workspaceId: workspace.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
      setOperation(null);
    }
  };

  // Handle agent restart
  const handleRestart = () => {
    if (!agentState.agentId) return;

    setLoading(true);
    setOperation('Restarting');
    try {
      const instance = restartAgent(agentState.agentId);
      initAgentState({ workspaceId: workspace.id, agentId: instance.id });
      setOutputPreview([]);
    } catch (err) {
      setStatus({
        workspaceId: workspace.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
      setOperation(null);
    }
  };

  // Handle attaching to tmux session
  const handleAttach = () => {
    if (!agentState.agentId || attaching) return;

    setAttaching(true);

    try {
      // This will take over the terminal until user detaches (Ctrl+B D)
      // spawnSync blocks completely, so Ink won't interfere
      attachToAgent(agentState.agentId);

      // After detach, sync status (agent may have exited)
      syncAgentStatus(agentState.agentId);
      const instance = getAgentInstance(agentState.agentId);
      if (instance && instance.status !== agentState.status) {
        setStatus({
          workspaceId: workspace.id,
          status: instance.status,
        });
      }
    } catch (err) {
      // Attachment failed or session ended
      setStatus({
        workspaceId: workspace.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setAttaching(false);
    }
  };

  // Centralized keyboard handling
  useInput((input, key) => {
    // Ignore input during loading or attaching
    if (loading || attaching) return;

    // Start agent
    if (input === 's' && (controlStatus === 'stopped' || controlStatus === 'error')) {
      handleStart();
      return;
    }

    // Stop agent
    if (input === 'x' && controlStatus === 'running') {
      handleStop();
      return;
    }

    // Restart agent
    if (input === 'r' && controlStatus === 'stopped') {
      handleRestart();
      return;
    }

    // Attach to agent session
    if (key.return && controlStatus === 'running') {
      handleAttach();
      return;
    }

    // Go back
    if (input === 'q' || key.escape) {
      onBack();
      return;
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">Agent View</Text>
        <Text color="gray"> - {workspace.name} ({workspace.branch})</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Agent: {workspace.agent} | Status: </Text>
        <Text color={controlStatus === 'running' ? 'green' : controlStatus === 'error' ? 'red' : 'yellow'}>
          {controlStatus.toUpperCase()}
        </Text>
      </Box>

      {/* Agent Controls */}
      <AgentControls
        agentId={agentState.agentId}
        status={controlStatus}
        loading={loading}
        operation={operation}
      />

      {/* Output Preview */}
      {controlStatus === 'running' && outputPreview.length > 0 && (
        <Box
          flexDirection="column"
          marginTop={1}
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
          height={12}
        >
          <Text color="gray" dimColor>Output preview (last 10 lines):</Text>
          {outputPreview.map((line, i) => (
            <Text key={i} wrap="truncate">{line}</Text>
          ))}
        </Box>
      )}

      {/* Error display */}
      {agentState.error && (
        <Box marginTop={1}>
          <Text color="red">Error: {agentState.error}</Text>
        </Box>
      )}

      {/* Instructions */}
      <Box marginTop={1} flexDirection="column">
        {controlStatus === 'running' && (
          <Box marginBottom={1}>
            <Text color="green" bold>Press Enter to attach to agent session</Text>
          </Box>
        )}
        <Text color="gray">
          {controlStatus === 'stopped' && 's: start | r: restart | '}
          {controlStatus === 'running' && 'x: stop | Enter: attach | '}
          {controlStatus === 'error' && 's: retry | '}
          q: back
        </Text>
        {controlStatus === 'running' && (
          <Text color="gray" dimColor>Ctrl+B D detaches from agent session</Text>
        )}
      </Box>
    </Box>
  );
}
