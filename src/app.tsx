// src/app.tsx
import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Provider, useAtom, useSetAtom } from 'jotai';
import { Settings } from './components/Settings.js';
import { CreateWorkspace } from './components/CreateWorkspace.js';
import { WorkspaceList } from './components/WorkspaceList.js';
import { WorkspaceTable } from './components/WorkspaceTable.js';
import { DetailedDiffView } from './components/DetailedDiffView.js';
import { DeleteWorkspaceConfirm } from './components/DeleteWorkspaceConfirm.js';
import { workspacesAtom, activeWorkspaceIdAtom, activeWorkspaceAtom, repoPathAtom, type Workspace } from './state/workspace.js';
import { settingsAtom } from './state/settings.js';
import { diffViewStateAtom } from './state/diff.js';
import { initAgentStateAtom } from './state/agents.js';
import { syncWorkspacesFromGit, gitWorktreeToWorkspace, deleteWorkspace } from './workspace/workspace-manager.js';
import { detectGitRoot } from './workspace/git-root.js';
import { spawnAgent, attachToAgent, getAgentByWorkspace } from './agents/spawn.js';
import { hasSession as hasAgentSession, createSession, killSession, killTerminalSession } from './agents/tmux.js';
import {
  createTerminalSession,
  hasTerminalSession,
  attachTerminalSession,
  attachSession
} from './agents/tmux.js';

type Screen = 'main' | 'settings' | 'create-workspace' | 'workspace-list' | 'diff-view' | 'delete-confirm';

function AppContent() {
  const { exit } = useApp();
  const [screen, setScreen] = useState<Screen>('main');
  const [workspaces, setWorkspaces] = useAtom(workspacesAtom);
  const [settings] = useAtom(settingsAtom);
  const [activeWorkspace, setActiveWorkspaceId] = useAtom(activeWorkspaceIdAtom);
  const [repoPath, setRepoPath] = useAtom(repoPathAtom);
  const [diffViewState, setDiffViewState] = useAtom(diffViewStateAtom);
  const initAgentState = useSetAtom(initAgentStateAtom);
  const [workspaceToDelete, setWorkspaceToDelete] = useState<Workspace | null>(null);

  // Auto-detect git repository on mount
  useEffect(() => {
    if (!repoPath) {
      const detectedRoot = detectGitRoot();
      if (detectedRoot) {
        setRepoPath(detectedRoot);
      }
    }
  }, [repoPath, setRepoPath]);

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
        }
      } catch (err) {
        console.error('[atelier] Failed to sync workspaces:', err);
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

  const handleDeleteWorkspace = (workspace: Workspace) => {
    setWorkspaceToDelete(workspace);
    setScreen('delete-confirm');
  };

  const handleConfirmDelete = async (options: { deleteFolder: boolean; deleteBranch: boolean }) => {
    if (!repoPath || !workspaceToDelete) return;

    try {
      // Kill tmux sessions if they exist
      if (hasAgentSession(workspaceToDelete.id)) {
        killSession(workspaceToDelete.id);
      }
      if (hasTerminalSession(workspaceToDelete.id)) {
        killTerminalSession(workspaceToDelete.id);
      }

      // Delete the workspace with specified options
      await deleteWorkspace(workspaceToDelete, repoPath, options);

      // Remove from state
      setWorkspaces(workspaces.filter(w => w.id !== workspaceToDelete.id));

      // Clear active workspace if it was deleted
      if (activeWorkspace === workspaceToDelete.id) {
        setActiveWorkspaceId(null);
      }
    } catch (err) {
      console.error('[atelier] Failed to delete workspace:', err);
    } finally {
      setWorkspaceToDelete(null);
      setScreen('main');
    }
  };

  const handleCancelDelete = () => {
    setWorkspaceToDelete(null);
    setScreen('main');
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

  if (screen === 'delete-confirm' && workspaceToDelete) {
    return (
      <DeleteWorkspaceConfirm
        workspace={workspaceToDelete}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
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
      onDeleteWorkspace={handleDeleteWorkspace}
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
