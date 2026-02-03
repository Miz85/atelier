// src/components/AgentPane.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useFocus } from 'ink';
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
import { showHelpAtom } from '../state/ui.js';
import type { Workspace } from '../state/workspace.js';

interface AgentPaneProps {
  workspace: Workspace;
}

/**
 * Agent output and controls pane.
 * Displays agent status, controls, and output preview.
 * Uses useFocus for Tab navigation between panes.
 */
export function AgentPane({ workspace }: AgentPaneProps) {
  const { isFocused } = useFocus({ id: 'agent-pane' });
  const [showHelp] = useAtom(showHelpAtom);

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

  // Keyboard handling - only active when pane is focused, help is not shown, and not attaching
  useInput((input, key) => {
    // Ignore input during loading
    if (loading) return;

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
  }, { isActive: isFocused && !showHelp && !attaching });

  return (
    <Box
      flexDirection="column"
      borderStyle={isFocused ? 'double' : 'single'}
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
      width="60%"
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={isFocused ? 'cyan' : 'white'}>
          {isFocused ? '> ' : '  '}Agent
        </Text>
        <Text color="gray"> - {workspace.name}</Text>
      </Box>

      {/* Agent info */}
      <Box marginBottom={1}>
        <Text>Agent: {workspace.agent} | </Text>
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
          height={10}
        >
          <Text color="gray" dimColor>Output preview:</Text>
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

      {/* Instructions when focused */}
      {isFocused && (
        <Box marginTop={1} flexDirection="column">
          {controlStatus === 'running' && (
            <Text color="green">Enter: attach</Text>
          )}
          <Text color="gray" dimColor>
            {controlStatus === 'stopped' && 's: start | r: restart'}
            {controlStatus === 'running' && 'x: stop'}
            {controlStatus === 'error' && 's: retry'}
          </Text>
        </Box>
      )}
    </Box>
  );
}
