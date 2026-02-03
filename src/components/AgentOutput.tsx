// src/components/AgentOutput.tsx
import React from 'react';
import { Box, Text, Static } from 'ink';

interface AgentOutputProps {
  outputLines: string[];
  maxVisibleLines?: number;
  showTimestamps?: boolean;
}

export function AgentOutput({
  outputLines,
  maxVisibleLines = 100,
  showTimestamps = false
}: AgentOutputProps) {
  // Get the last N lines if maxVisibleLines is set
  const visibleLines = maxVisibleLines > 0
    ? outputLines.slice(-maxVisibleLines)
    : outputLines;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">Agent Output</Text>
        <Text color="gray"> ({outputLines.length} lines)</Text>
      </Box>

      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        {visibleLines.length === 0 ? (
          <Text color="gray" dimColor>Waiting for agent output...</Text>
        ) : (
          <Static items={visibleLines}>
            {(line, index) => (
              <Box key={index}>
                {showTimestamps && (
                  <Text color="gray" dimColor>
                    [{new Date().toLocaleTimeString()}]{' '}
                  </Text>
                )}
                <Text>{line}</Text>
              </Box>
            )}
          </Static>
        )}
      </Box>

      {maxVisibleLines > 0 && outputLines.length > maxVisibleLines && (
        <Box marginTop={1}>
          <Text color="yellow" dimColor>
            Showing last {maxVisibleLines} of {outputLines.length} lines
          </Text>
        </Box>
      )}
    </Box>
  );
}
