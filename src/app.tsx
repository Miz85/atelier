// src/app.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Provider, useAtom, useSetAtom } from 'jotai';
import { Settings } from './components/Settings.js';
import { CreateWorkspace } from './components/CreateWorkspace.js';
import { WorkspaceList } from './components/WorkspaceList.js';
import { ThreePaneLayout } from './components/ThreePaneLayout.js';
import { WorkspaceTable } from './components/WorkspaceTable.js';
import { DetailedDiffView } from './components/DetailedDiffView.js';
import { workspacesAtom, activeWorkspaceAtom, repoPathAtom, type Workspace } from './state/workspace.js';
import { settingsAtom } from './state/settings.js';
import { diffViewStateAtom } from './state/diff.js';
import { syncWorkspacesFromGit, gitWorktreeToWorkspace } from './workspace/workspace-manager.js';
import { attachToAgent } from './agents/spawn.js';
import {
  createTerminalSession,
  hasTerminalSession,
  attachTerminalSession
} from './agents/tmux.js';

type Screen = 'main' | 'settings' | 'create-workspace' | 'workspace-list' | 'workspace-view' | 'diff-view';

function AppContent() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('main');
  const [workspaces, setWorkspaces] = useAtom(workspacesAtom);
  const [settings] = useAtom(settingsAtom);
  const [activeWorkspace] = useAtom(activeWorkspaceAtom);
  const [repoPath] = useAtom(repoPathAtom);
  const [diffViewState, setDiffViewState] = useAtom(diffViewStateAtom);

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

  // Handler functions
  const handleAttachAgent = (workspace: Workspace) => {
    try {
      const agentId = workspace.id; // Agent ID is workspace ID
      attachToAgent(agentId);
      // After detach, clear screen
      process.stdout.write('\x1b[2J\x1b[H');
    } catch (err) {
      // Attachment failed - silent for now
    }
  };

  const handleAttachTerminal = (workspace: Workspace) => {
    try {
      // Create session if it doesn't exist
      if (!hasTerminalSession(workspace.id)) {
        createTerminalSession(workspace.id, workspace.path);
      }

      // Attach to session (blocking)
      attachTerminalSession(workspace.id);
    } catch (err) {
      // Attachment failed - silent for now
    }
  };

  const handleOpenDiffView = (workspace: Workspace) => {
    setDiffViewState({
      workspaceId: workspace.id,
      selectedFilePath: null,
      selectedFileContent: null,
    });
    setScreen('diff-view');
  };

  const handleOpenWorkspaceView = (workspace: Workspace) => {
    setScreen('workspace-view');
  };

  // Global quit shortcut
  useInput((input, key) => {
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

  if (screen === 'workspace-view') {
    if (!activeWorkspace) {
      setScreen('main');
      return null;
    }
    return (
      <ThreePaneLayout
        workspace={activeWorkspace}
        onBack={() => setScreen('main')}
      />
    );
  }

  if (screen === 'diff-view') {
    // Find the workspace from diffViewState
    const workspace = workspaces.find(w => w.id === diffViewState?.workspaceId);
    if (!workspace) {
      setScreen('main');
      return null;
    }
    return (
      <DetailedDiffView
        workspace={workspace}
        onBack={() => setScreen('main')}
      />
    );
  }

  // Main screen - WorkspaceTable
  return (
    <WorkspaceTable
      onCreateWorkspace={() => setScreen('create-workspace')}
      onSettings={() => setScreen('settings')}
      onOpenDiffView={handleOpenDiffView}
      onAttachAgent={handleAttachAgent}
      onAttachTerminal={handleAttachTerminal}
      onOpenWorkspaceView={handleOpenWorkspaceView}
    />
  );
}

export function App() {
  return (
    <Provider>
      <AppContent />
    </Provider>
  );
}
