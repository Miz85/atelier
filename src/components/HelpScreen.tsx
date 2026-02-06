// src/components/HelpScreen.tsx
import React from 'react';
import { Box, Text, useInput } from 'ink';

interface HelpScreenProps {
  onClose: () => void;
}

/**
 * Keyboard shortcuts help screen modal overlay.
 * Displays all available keyboard shortcuts organized by category.
 * Closes with ? key or Escape.
 */
export function HelpScreen({ onClose }: HelpScreenProps) {
  useInput((input, key) => {
    if (input === '?' || key.escape) {
      onClose();
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="yellow"
      padding={1}
    >
      <Text bold color="yellow" underline>
        Keyboard Shortcuts
      </Text>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Navigation:</Text>
        <Text>  Tab           Next pane</Text>
        <Text>  Shift+Tab     Previous pane</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Agent Pane (when focused):</Text>
        <Text>  [type]        Send input to agent</Text>
        <Text>  Enter         Send Enter to agent</Text>
        <Text>  Ctrl+C        Send interrupt to agent</Text>
        <Text>  Arrows        Navigate in agent</Text>
        <Text>  Shift+F       Fullscreen (smooth interaction)</Text>
        <Text>  Shift+X       Stop agent</Text>
        <Text>  s             Start agent (when stopped)</Text>
        <Text>  r             Restart agent (when stopped)</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Fullscreen Mode:</Text>
        <Text>  Ctrl+B D      Detach (return to atelier)</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text bold>Global:</Text>
        <Text>  ?             Toggle this help</Text>
        <Text>  q             Quit application</Text>
        <Text>  Esc           Go back / Close modal</Text>
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Press ? or Esc to close</Text>
      </Box>
    </Box>
  );
}
