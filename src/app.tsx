// src/app.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Provider, useAtom } from 'jotai';
import { Settings } from './components/Settings.js';
import { CreateWorkspace } from './components/CreateWorkspace.js';
import { WorkspaceList } from './components/WorkspaceList.js';
import { AgentView } from './components/AgentView.js';
import { workspacesAtom, activeWorkspaceAtom, repoPathAtom } from './state/workspace.js';
import { settingsAtom } from './state/settings.js';
import { syncWorkspacesFromGit, gitWorktreeToWorkspace } from './workspace/workspace-manager.js';

type Screen = 'main' | 'settings' | 'create-workspace' | 'workspace-list' | 'agent-view';

function AppContent() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('main');
  const [workspaces, setWorkspaces] = useAtom(workspacesAtom);
  const [settings] = useAtom(settingsAtom);
  const [activeWorkspace] = useAtom(activeWorkspaceAtom);
  const [repoPath] = useAtom(repoPathAtom);

  // Sync workspaces from git worktrees when repoPath is set or changes
  useEffect(() => {
    if (!repoPath) return;

    const doSync = async () => {
      try {
        const result = await syncWorkspacesFromGit(repoPath, workspaces);

        // Only update if there are changes
        if (result.toAdd.length > 0 || result.toRemove.length > 0) {
          // Convert GitWorktrees to Workspaces
          const newWorkspaces = result.toAdd.map(gw =>
            gitWorktreeToWorkspace(gw, settings)
          );

          // Merge: keep unchanged, add new, remove orphaned
          const toRemoveIds = new Set(result.toRemove.map(w => w.id));
          const merged = [
            ...result.unchanged,
            ...newWorkspaces,
          ].filter(w => !toRemoveIds.has(w.id));

          setWorkspaces(merged);

          // Log for debugging (remove later or make conditional)
          if (result.toAdd.length > 0) {
            console.log(`[equipe] Synced ${result.toAdd.length} external worktree(s)`);
          }
          if (result.toRemove.length > 0) {
            console.log(`[equipe] Removed ${result.toRemove.length} orphaned workspace(s)`);
          }
        }
      } catch (err) {
        console.error('[equipe] Failed to sync workspaces:', err);
      }
    };

    doSync();
    // Only re-run when repoPath changes, not on every workspaces change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoPath]);

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
    if (input === 'a' && activeWorkspace) {
      setScreen('agent-view');
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

  if (screen === 'agent-view') {
    if (!activeWorkspace) {
      setScreen('main');
      return null;
    }
    return <AgentView workspace={activeWorkspace} onBack={() => setScreen('main')} />;
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
        <Text color="gray">
          n: new workspace | w: list workspaces | s: settings
          {activeWorkspace && ' | a: agent view'} | q: quit
        </Text>
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
