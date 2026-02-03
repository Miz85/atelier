// src/components/AgentControls.tsx
import React from 'react';
import { Box, Text } from 'ink';

interface AgentControlsProps {
  agentId: string | null;
  status: 'running' | 'stopped' | 'error';
  loading?: boolean;
  operation?: string | null;
}

/**
 * Presentational component for agent status and control hints.
 * Keyboard handling is done by parent (AgentView).
 */
export function AgentControls({
  agentId,
  status,
  loading = false,
  operation = null,
}: AgentControlsProps) {
  const statusColor = status === 'running' ? 'green' : status === 'error' ? 'red' : 'yellow';
  const statusText = status.toUpperCase();

  // Show restart only if we have an agentId (agent was started before)
  const showRestart = status === 'stopped' && agentId;

  return (
    <Box flexDirection="column" paddingX={1} marginBottom={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Agent Controls</Text>
      </Box>

      <Box marginBottom={1}>
        <Text>Status: </Text>
        <Text bold color={statusColor}>{statusText}</Text>
        {loading && operation && (
          <Text color="cyan"> {operation}...</Text>
        )}
      </Box>

      <Box flexDirection="column">
        <Text color="gray">
          {status === 'stopped' && (showRestart ? 's: start | r: restart' : 's: start')}
          {status === 'running' && 'x: stop'}
          {status === 'error' && (showRestart ? 's: start | r: restart' : 's: start')}
        </Text>
      </Box>
    </Box>
  );
}
