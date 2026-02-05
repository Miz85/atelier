// src/app.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Provider, useAtom, useSetAtom } from 'jotai';
import { Settings } from './components/Settings.js';
import { CreateWorkspace } from './components/CreateWorkspace.js';
import { WorkspaceList } from './components/WorkspaceList.js';
import { WorkspaceTable } from './components/WorkspaceTable.js';
import { DetailedDiffView } from './components/DetailedDiffView.js';
import { workspacesAtom, activeWorkspaceIdAtom, activeWorkspaceAtom, repoPathAtom, type Workspace } from './state/workspace.js';
import { settingsAtom } from './state/settings.js';
import { diffViewStateAtom } from './state/diff.js';
import { initAgentStateAtom } from './state/agents.js';
import { syncWorkspacesFromGit, gitWorktreeToWorkspace } from './workspace/workspace-manager.js';
import { spawnAgent, attachToAgent, getAgentByWorkspace } from './agents/spawn.js';
import { hasSession as hasAgentSession, createSession } from './agents/tmux.js';
import {
  createTerminalSession,
  hasTerminalSession,
  attachTerminalSession,
  attachSession
} from './agents/tmux.js';

type Screen = 'main' | 'settings' | 'create-workspace' | 'workspace-list' | 'diff-view';

function AppContent() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('main');
  const [workspaces, setWorkspaces] = useAtom(workspacesAtom);
  const [settings] = useAtom(settingsAtom);
  const [activeWorkspace, setActiveWorkspaceId] = useAtom(activeWorkspaceIdAtom);
  const [repoPath] = useAtom(repoPathAtom);
  const [diffViewState, setDiffViewState] = useAtom(diffViewStateAtom);
  const initAgentState = useSetAtom(initAgentStateAtom);

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
      // Check if agent is already running (use workspace ID to look up)
      const agentInstance = getAgentByWorkspace(workspace.id);

      if (!agentInstance || !hasAgentSession(workspace.id)) {
        // Start agent if not running
        const instance = spawnAgent(workspace.id, workspace.path, workspace.agent);
        initAgentState({ workspaceId: workspace.id, agentId: instance.id });
      }

      // Attach to session (synchronous, blocks until user detaches)
      if (hasAgentSession(workspace.id)) {
        attachSession(workspace.id);
      }
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
    // Set as active workspace and attach to agent
    setActiveWorkspaceId(workspace.id);
    handleAttachAgent(workspace);
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
