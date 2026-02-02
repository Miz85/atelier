// src/app.tsx
import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Provider, useAtom } from 'jotai';
import { Settings } from './components/Settings.js';
import { workspacesAtom } from './state/workspace.js';
import { settingsAtom } from './state/settings.js';

type Screen = 'main' | 'settings';

function AppContent() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('main');
  const [workspaces] = useAtom(workspacesAtom);
  const [settings] = useAtom(settingsAtom);

  useInput((input, key) => {
    if (screen !== 'main') return;

    // Global shortcuts
    if (input === 's') {
      setScreen('settings');
    }
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    }
  });

  if (screen === 'settings') {
    return <Settings onBack={() => setScreen('main')} />;
  }

  // Main screen
  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">equipe</Text>
        <Text color="gray"> - Coding Agent Workspace Manager</Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text>Workspaces: {workspaces.length}</Text>
        <Text>Default Agent: {settings.defaultAgent}</Text>
        <Text>IDE: {settings.ideCommand}</Text>
      </Box>

      {workspaces.length === 0 ? (
        <Box marginBottom={1}>
          <Text color="yellow">No workspaces yet. (Phase 2 will add workspace creation)</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginBottom={1}>
          {workspaces.map((ws) => (
            <Text key={ws.id}>
              - {ws.name} ({ws.branch}) [{ws.agent}]
            </Text>
          ))}
        </Box>
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color="gray">s: settings | q: quit</Text>
      </Box>
    </Box>
  );
}

export function App() {
  return (
    <Provider>
      <AppContent />
    </Provider>
  );
}
