// src/components/AgentControls.tsx
import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { stopAgent, restartAgent } from '../agents/spawn.js';

interface AgentControlsProps {
  agentId: string | null;
  status: 'running' | 'stopped' | 'error';
  onStart?: () => void;
  onStop?: (agentId: string) => void;
  onRestart?: (agentId: string) => void;
  onError?: (error: Error) => void;
}

export function AgentControls({
  agentId,
  status,
  onStart,
  onStop,
  onRestart,
  onError
}: AgentControlsProps) {
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<string | null>(null);

  useInput((input, key) => {
    if (loading) return; // Ignore input during operations

    // Start agent
    if (input === 's' && status === 'stopped' && onStart) {
      setLoading(true);
      setOperation('Starting');
      try {
        onStart();
      } catch (err) {
        onError?.(err as Error);
      } finally {
        setLoading(false);
        setOperation(null);
      }
    }

    // Stop agent
    if (input === 'x' && status === 'running' && agentId && onStop) {
      setLoading(true);
      setOperation('Stopping');
      stopAgent(agentId)
        .then(() => {
          onStop?.(agentId);
        })
        .catch((err) => {
          onError?.(err as Error);
        })
        .finally(() => {
          setLoading(false);
          setOperation(null);
        });
    }

    // Restart agent
    if (input === 'r' && status === 'stopped' && agentId && onRestart) {
      setLoading(true);
      setOperation('Restarting');
      try {
        onRestart(agentId);
      } catch (err) {
        onError?.(err as Error);
      } finally {
        setLoading(false);
        setOperation(null);
      }
    }
  });

  const statusColor = status === 'running' ? 'green' : status === 'error' ? 'red' : 'yellow';
  const statusText = status.toUpperCase();

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
          {status === 'stopped' && 's: start | r: restart'}
          {status === 'running' && 'x: stop'}
          {status === 'error' && 's: start | r: restart'}
        </Text>
      </Box>
    </Box>
  );
}
