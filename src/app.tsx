// src/app.tsx
import React, { useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Provider, useAtom } from 'jotai';
import { Settings } from './components/Settings.js';
import { CreateWorkspace } from './components/CreateWorkspace.js';
import { WorkspaceList } from './components/WorkspaceList.js';
import { workspacesAtom, activeWorkspaceAtom, repoPathAtom } from './state/workspace.js';
import { settingsAtom } from './state/settings.js';

type Screen = 'main' | 'settings' | 'create-workspace' | 'workspace-list';

function AppContent() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('main');
  const [workspaces] = useAtom(workspacesAtom);
  const [settings] = useAtom(settingsAtom);
  const [activeWorkspace] = useAtom(activeWorkspaceAtom);
  const [repoPath] = useAtom(repoPathAtom);

  useInput((input, key) => {
    if (screen !== 'main') return;

    // Global shortcuts
    if (input === 'n') {
      setScreen('create-workspace');
    }
    if (input === 'w') {
      setScreen('workspace-list');
    }
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

  if (screen === 'create-workspace') {
    return <CreateWorkspace onBack={() => setScreen('main')} />;
  }

  if (screen === 'workspace-list') {
    return <WorkspaceList onBack={() => setScreen('main')} />;
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
        {activeWorkspace ? (
          <Text color="green">Active: {activeWorkspace.name} ({activeWorkspace.branch})</Text>
        ) : (
          <Text color="yellow">No active workspace</Text>
        )}
        <Text>Default Agent: {settings.defaultAgent}</Text>
        <Text>IDE: {settings.ideCommand}</Text>
        {repoPath && <Text color="gray">Repo: {repoPath}</Text>}
      </Box>

      <Box marginTop={1} flexDirection="column">
        <Text color="gray">n: new workspace | w: list workspaces | s: settings | q: quit</Text>
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
