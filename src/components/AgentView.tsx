// src/components/AgentView.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import { useAtom, useSetAtom } from 'jotai';
import { AgentOutput } from './AgentOutput.js';
import { AgentControls } from './AgentControls.js';
import { spawnAgent, restartAgent, sendInput } from '../agents/spawn.js';
import {
  getWorkspaceAgentStateAtom,
  initAgentStateAtom,
  appendOutputAtom,
  setStatusAtom,
  clearOutputAtom,
} from '../state/agents.js';
import type { Workspace } from '../state/workspace.js';

interface AgentViewProps {
  workspace: Workspace;
  onBack: () => void;
}

export function AgentView({ workspace, onBack }: AgentViewProps) {
  // Agent state for this workspace
  const workspaceAgentStateAtom = getWorkspaceAgentStateAtom(workspace.id);
  const [agentState] = useAtom(workspaceAgentStateAtom);

  // Action atoms
  const initAgentState = useSetAtom(initAgentStateAtom);
  const appendOutput = useSetAtom(appendOutputAtom);
  const setStatus = useSetAtom(setStatusAtom);
  const clearOutput = useSetAtom(clearOutputAtom);

  // Input mode state
  const [inputMode, setInputMode] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Handle agent spawn
  const handleStart = () => {
    try {
      const instance = spawnAgent(
        workspace.id,
        workspace.path,
        workspace.agent,
        {
          onData: (data) => {
            // Split by lines and append each
            const lines = data.split('\n').filter(line => line.trim());
            lines.forEach(line => {
              appendOutput({ workspaceId: workspace.id, line });
            });
          },
          onExit: (exitCode, signal) => {
            const status = exitCode === 0 ? 'stopped' : 'error';
            const error = exitCode !== 0 ? `Agent exited with code ${exitCode}` : undefined;
            setStatus({ workspaceId: workspace.id, status, error });
          },
        }
      );

      // Initialize agent state in Jotai
      initAgentState({ workspaceId: workspace.id, agentId: instance.id });
    } catch (err) {
      setStatus({
        workspaceId: workspace.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Handle agent restart
  const handleRestart = (agentId: string) => {
    try {
      // Clear old output
      clearOutput(workspace.id);

      const instance = restartAgent(agentId, {
        onData: (data) => {
          const lines = data.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            appendOutput({ workspaceId: workspace.id, line });
          });
        },
        onExit: (exitCode, signal) => {
          const status = exitCode === 0 ? 'stopped' : 'error';
          const error = exitCode !== 0 ? `Agent exited with code ${exitCode}` : undefined;
          setStatus({ workspaceId: workspace.id, status, error });
        },
      });

      // Update agent state with new instance
      initAgentState({ workspaceId: workspace.id, agentId: instance.id });
    } catch (err) {
      setStatus({
        workspaceId: workspace.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  // Handle agent stop
  const handleStop = (agentId: string) => {
    // Status will be updated by onExit callback in spawn
  };

  // Handle input submission
  const handleInputSubmit = (value: string) => {
    if (!agentState.agentId) return;

    try {
      sendInput(agentState.agentId, value);
      setInputValue('');
      setInputMode(false);
    } catch (err) {
      setStatus({
        workspaceId: workspace.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
      setInputMode(false);
    }
  };

  // Keyboard shortcuts
  useInput((input, key) => {
    // In input mode, only Escape works
    if (inputMode) {
      if (key.escape) {
        setInputMode(false);
        setInputValue('');
      }
      return;
    }

    // Enter input mode
    if (input === 'i' && agentState.status === 'running') {
      setInputMode(true);
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
        <Text>Agent: {workspace.agent}</Text>
      </Box>

      {/* Agent Controls */}
      <AgentControls
        agentId={agentState.agentId}
        status={agentState.status === 'idle' ? 'stopped' : agentState.status}
        onStart={handleStart}
        onStop={handleStop}
        onRestart={handleRestart}
        onError={(err) => {
          setStatus({
            workspaceId: workspace.id,
            status: 'error',
            error: err.message,
          });
        }}
      />

      {/* Agent Output */}
      <AgentOutput
        outputLines={agentState.outputLines}
        maxVisibleLines={100}
      />

      {/* Error display */}
      {agentState.error && (
        <Box marginTop={1}>
          <Text color="red">Error: {agentState.error}</Text>
        </Box>
      )}

      {/* Input mode */}
      {inputMode ? (
        <Box marginTop={1} flexDirection="column">
          <Text color="cyan">Input mode (send to agent):</Text>
          <Box>
            <Text color="gray">&gt; </Text>
            <TextInput
              value={inputValue}
              onChange={setInputValue}
              onSubmit={handleInputSubmit}
              placeholder="Type message..."
            />
          </Box>
          <Text color="gray" dimColor>Esc: cancel</Text>
        </Box>
      ) : (
        <Box marginTop={1}>
          <Text color="gray">
            {agentState.status === 'running' && 'i: input mode | '}
            q: back
          </Text>
        </Box>
      )}
    </Box>
  );
}
