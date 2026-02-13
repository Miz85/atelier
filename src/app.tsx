// src/app.tsx
import { useState, useEffect } from 'react';
import { useApp, useInput } from 'ink';
import { Provider, useAtom, useSetAtom } from 'jotai';
import { Settings } from './components/Settings.js';
import { CreateWorkspace } from './components/CreateWorkspace.js';
import { WorkspaceList } from './components/WorkspaceList.js';
import { WorkspaceTable } from './components/WorkspaceTable.js';
import { DetailedDiffView } from './components/DetailedDiffView.js';
import { DeleteWorkspaceConfirm } from './components/DeleteWorkspaceConfirm.js';
import { workspacesAtom, activeWorkspaceIdAtom, repoPathAtom, type Workspace } from './state/workspace.js';
import { settingsAtom } from './state/settings.js';
import { diffViewStateAtom } from './state/diff.js';
import { initAgentStateAtom } from './state/agents.js';
import { gitWorktreeToWorkspace, deleteWorkspace } from './workspace/workspace-manager.js';
import { detectGitRoot } from './workspace/git-root.js';
import { spawnAgent, getAgentByWorkspace } from './agents/spawn.js';
import { hasSession as hasAgentSession, killSession, killTerminalSession } from './agents/tmux.js';
import {
  createTerminalSession,
  hasTerminalSession,
  attachTerminalSession,
  attachSession
} from './agents/tmux.js';
import { listWorktrees } from './workspace/git-worktree.js';
import { realpathSync } from 'node:fs';

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
  const [renderKey, setRenderKey] = useState(0); // Force re-render after tmux detach

  // Auto-detect git repository on mount
  useEffect(() => {
    const detectedRoot = detectGitRoot();
    if (detectedRoot) {
      setRepoPath(detectedRoot);
    }
  }, []);


  // Sync workspaces from git worktrees when repoPath is set or changes
  useEffect(() => {
    if (!repoPath) {
      setWorkspaces([]);
      return;
    }

    const doSync = async () => {
      try {
        const gitWorktrees = await listWorktrees(repoPath);
        const mainRepoRealPath = realpathSync(repoPath);
        const validWorktrees = gitWorktrees.filter(
          gw => gw.path !== mainRepoRealPath
        );

        const newWorkspaces = validWorktrees.map(gw =>
          gitWorktreeToWorkspace(gw, settings)
        );

        setWorkspaces(newWorkspaces);
      } catch (err) {
        console.error('[atelier] Failed to sync workspaces:', err);
        setWorkspaces([]);
      }
    };

    doSync();
  }, [repoPath, setWorkspaces, settings]);

  // Handler functions
  const handleAttachAgent = (workspace: Workspace) => {
    try {
      // Set as active workspace so cursor returns here after detach
      setActiveWorkspaceId(workspace.id);

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
        // Defer state update to next tick to ensure terminal is fully restored
        setImmediate(() => {
          setRenderKey(k => k + 1);
        });
      }
    } catch (err) {
      // Attachment failed - silent for now
    }
  };

  const handleAttachTerminal = (workspace: Workspace) => {
    try {
      // Set as active workspace so cursor returns here after detach
      setActiveWorkspaceId(workspace.id);

      // Create session if it doesn't exist
      if (!hasTerminalSession(workspace.id)) {
        createTerminalSession(workspace.id, workspace.path);
      }

      // Attach to session (blocking)
      attachTerminalSession(workspace.id);
      // Defer state update to next tick to ensure terminal is fully restored
      setImmediate(() => {
        setRenderKey(k => k + 1);
      });
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
      key={renderKey}
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
