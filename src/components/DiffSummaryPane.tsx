// src/components/DiffSummaryPane.tsx
import React from 'react';
import { Box, Text, useFocus } from 'ink';

/**
 * Placeholder diff summary pane for Phase 5 (GIT-01 diff viewing).
 * Uses useFocus for Tab navigation between panes.
 */
export function DiffSummaryPane() {
  const { isFocused } = useFocus({ id: 'diff-pane' });

  return (
    <Box
      flexDirection="column"
      borderStyle={isFocused ? 'double' : 'single'}
      borderColor={isFocused ? 'cyan' : 'gray'}
      paddingX={1}
      width="40%"
    >
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={isFocused ? 'cyan' : 'white'}>
          {isFocused ? '> ' : '  '}Diff Summary
        </Text>
      </Box>

      {/* Placeholder content */}
      <Box flexDirection="column" flexGrow={1}>
        <Text color="gray">Coming in Phase 5</Text>
        <Text color="gray" dimColor>
          Git diff viewing (GIT-01)
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
