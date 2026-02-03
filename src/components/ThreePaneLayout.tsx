// src/components/ThreePaneLayout.tsx
import React from 'react';
import { Box, useInput } from 'ink';
import { useAtom } from 'jotai';
import { AgentPane } from './AgentPane.js';
import { DiffSummaryPane } from './DiffSummaryPane.js';
import { TerminalPane } from './TerminalPane.js';
import { HelpScreen } from './HelpScreen.js';
import { showHelpAtom } from '../state/ui.js';
import type { Workspace } from '../state/workspace.js';

interface ThreePaneLayoutProps {
  workspace: Workspace;
  onBack: () => void;
}

/**
 * Three-pane layout container with focus management.
 * Renders AgentPane (40%), DiffSummaryPane (40%), TerminalPane (20%).
 * Handles global keyboard input for ? (toggle help) and q/Esc (back).
 * Tab navigation between panes is handled by Ink's useFocus system.
 */
export function ThreePaneLayout({ workspace, onBack }: ThreePaneLayoutProps) {
  const [showHelp, setShowHelp] = useAtom(showHelpAtom);

  // Global keyboard shortcuts - only active when help is not showing
  useInput((input, key) => {
    // Toggle help screen
    if (input === '?') {
      setShowHelp(true);
      return;
    }

    // Go back to main screen
    if (input === 'q' || key.escape) {
      onBack();
      return;
    }
  }, { isActive: !showHelp });

  return (
    <Box flexDirection="column" height="100%">
      {/* Three-pane horizontal layout */}
      <Box flexDirection="row" flexGrow={1}>
        <AgentPane workspace={workspace} />
        <DiffSummaryPane />
        <TerminalPane />
      </Box>

      {/* Help screen modal overlay */}
      {showHelp && (
        <Box
          position="absolute"
          width="100%"
          height="100%"
          justifyContent="center"
          alignItems="center"
        >
          <HelpScreen onClose={() => setShowHelp(false)} />
        </Box>
      )}
    </Box>
  );
}
