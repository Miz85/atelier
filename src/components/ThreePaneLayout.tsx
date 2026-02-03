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
 * Top row: AgentPane (60%), DiffSummaryPane (40%)
 * Bottom row: TerminalPane (100%)
 * Handles global keyboard input for ? (toggle help) and q/Esc (back).
 * Tab navigation between panes is handled by Ink's useFocus system.
 */
export function ThreePaneLayout({ workspace, onBack }: ThreePaneLayoutProps) {
  const [showHelp, setShowHelp] = useAtom(showHelpAtom);

  // Global keyboard shortcuts - always listen for Escape
  useInput((input, key) => {
    // Debug: uncomment to see key presses
    // process.stderr.write(`Key: ${JSON.stringify({input, esc: key.escape})}\n`);

    // Escape always goes back (even when help showing)
    if (key.escape) {
      if (showHelp) {
        setShowHelp(false);
      } else {
        onBack();
      }
      return;
    }

    // 'b' as backup for going back
    if (input === 'b' && !showHelp) {
      onBack();
      return;
    }

    // Rest only when help is not showing
    if (showHelp) return;

    // Toggle help screen
    if (input === '?') {
      setShowHelp(true);
      return;
    }

    // Go back to main screen
    if (input === 'q') {
      onBack();
      return;
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      {/* Top row: Agent (60%) + Diff Summary (40%) */}
      <Box flexDirection="row" flexGrow={1}>
        <AgentPane workspace={workspace} />
        <DiffSummaryPane />
      </Box>

      {/* Bottom row: Terminal (full width) */}
      <TerminalPane />

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
