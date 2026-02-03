// src/components/TerminalPane.tsx
import React from 'react';
import { Box, Text, useFocus } from 'ink';

/**
 * Placeholder terminal pane for Phase 5 (terminal integration).
 * Uses useFocus for Tab navigation between panes.
 */
export function TerminalPane() {
  const { isFocused } = useFocus({ id: 'terminal-pane' });

  return (
    <Box
      flexDirection="column"
      borderStyle={isFocused ? 'double' : 'single'}
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
      width="20%"
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={isFocused ? 'cyan' : 'white'}>
          {isFocused ? '> ' : '  '}Terminal
        </Text>
      </Box>

      {/* Placeholder content */}
      <Box flexDirection="column" flexGrow={1}>
        <Text color="gray">Coming in Phase 5</Text>
        <Text color="gray" dimColor>
          Terminal integration
        </Text>
      </Box>

      {/* Focus hint */}
      {isFocused && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>Tab to switch panes</Text>
        </Box>
      )}
    </Box>
  );
}
