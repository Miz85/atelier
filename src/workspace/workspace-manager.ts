// src/workspace/workspace-manager.ts
import { nanoid } from 'nanoid';
import { dirname, join } from 'node:path';
import { realpathSync } from 'node:fs';
import { addWorktree, removeWorktree, deleteBranch, listWorktrees, type GitWorktree } from './git-worktree.js';
import { processRegistry } from '../processes/cleanup.js';
import type { Workspace } from '../state/workspace.js';
import type { Settings } from '../state/settings.js';

export interface CreateWorkspaceOptions {
  repoPath: string;           // Path to the main git repository
  branchName: string;         // New branch name for this workspace
  name?: string;              // User-friendly name (defaults to branch name)
  agent?: 'claude' | 'opencode';  // Agent type (defaults to 'claude')
  baseBranch?: string;        // Base branch to create from (auto-detected if not specified)
}

/**
 * Create a new workspace with git worktree.
 *
 * Steps:
 * 1. Generate unique ID
 * 2. Compute worktree path (sibling to repo: /repo -> /repo-branchname)
 * 3. Create git worktree with new branch
 * 4. Return Workspace object (caller adds to state)
 *
 * Does NOT start agent - that's Phase 3.
 * Does NOT update state - caller handles that with Jotai.
 */
export async function createWorkspace(options: CreateWorkspaceOptions): Promise<Workspace> {
  const {
    repoPath,
    branchName,
    name = branchName,
    agent = 'claude',
    baseBranch,  // Auto-detected by addWorktree if not specified
  } = options;

  // Generate unique ID
  const id = nanoid();

  // Compute worktree path as sibling to repo
  // /path/to/repo -> /path/to/repo-feature-branch
  // Replace / in branch names with - for filesystem safety
  const safeBranchName = branchName.replace(/\//g, '-');
  const worktreePath = `${repoPath}-${safeBranchName}`;

  // Create git worktree
  await addWorktree(repoPath, worktreePath, branchName, baseBranch);

  // Resolve the real path to handle symlinks (matches what git worktree list returns)
  const realWorktreePath = realpathSync(worktreePath);

  // Create workspace record
  const now = new Date().toISOString();
  const workspace: Workspace = {
    id,
    name,
    path: realWorktreePath,
    branch: branchName,
    agent,
    pid: undefined,  // No agent running yet
    createdAt: now,
    lastActiveAt: now,
  };

  return workspace;
}

export interface DeleteWorkspaceOptions {
  deleteFolder: boolean;  // Whether to delete the git worktree folder
  deleteBranch: boolean;  // Whether to delete the git branch
}

/**
 * Delete a workspace and optionally its git worktree and/or branch.
 *
 * Steps:
 * 1. Kill agent process if running (via PID in workspace)
 * 2. Optionally remove git worktree folder
 * 3. Optionally delete git branch
 * 4. Caller removes from state
 *
 * @param workspace - The workspace to delete
 * @param repoPath - Path to the main repository
 * @param options - What to delete (folder and/or branch)
 */
export async function deleteWorkspace(
  workspace: Workspace,
  repoPath: string,
  options: DeleteWorkspaceOptions
): Promise<void> {
  // Kill agent process if running
  if (workspace.pid !== undefined) {
    console.log(`[WorkspaceManager] Killing agent process ${workspace.pid}`);
    try {
      process.kill(workspace.pid, 'SIGTERM');
      // Give it a moment to exit gracefully
      await new Promise(resolve => setTimeout(resolve, 500));
      // Force kill if still running
      try {
        process.kill(workspace.pid, 0); // Check if still alive
        process.kill(workspace.pid, 'SIGKILL');
      } catch {
        // Process already dead, good
      }
    } catch (err) {
      // Process may already be dead
      console.log(`[WorkspaceManager] Process ${workspace.pid} already dead`);
    }
  }

  // Remove git worktree if requested
  if (options.deleteFolder) {
    await removeWorktree(repoPath, workspace.path);
  }

  // Delete the branch if requested
  // Use force delete since the branch may have been checked out in the worktree
  if (options.deleteBranch) {
    await deleteBranch(repoPath, workspace.branch, true);
  }
}

/**
 * Synchronize app state from git worktree state.
 *
 * Git worktrees are source of truth. This function:
 * - Identifies worktrees in git but not in app (to add)
 * - Identifies workspaces in app but not in git (to remove)
 * - Returns lists so caller can update state
 *
 * Called on app startup and after manual git operations.
 *
 * @param repoPath - Path to main repository
 * @param currentWorkspaces - Current workspaces from app state
 */
export async function syncWorkspacesFromGit(
  repoPath: string,
  currentWorkspaces: Workspace[]
): Promise<{
  toAdd: GitWorktree[];
  toRemove: Workspace[];
  unchanged: Workspace[];
}> {
  const gitWorktrees = await listWorktrees(repoPath);

  // Resolve main repo path to handle symlinks (e.g., /tmp -> /private/tmp on macOS)
  const mainRepoRealPath = realpathSync(repoPath);

  // Build lookup by path (path is unique identifier)
  const gitPaths = new Set(gitWorktrees.map(w => w.path));
  const appPaths = new Map(currentWorkspaces.map(w => [w.path, w]));

  // Worktrees in git but not in app -> need to add
  // Skip the main worktree (it's the repo itself, not a workspace)
  const toAdd = gitWorktrees.filter(gw =>
    !appPaths.has(gw.path) && gw.path !== mainRepoRealPath
  );

  // Workspaces in app but not in git -> need to remove
  const toRemove = currentWorkspaces.filter(w => !gitPaths.has(w.path));

  // Both exist -> unchanged
  const unchanged = currentWorkspaces.filter(w => gitPaths.has(w.path));

  return { toAdd, toRemove, unchanged };
}

/**
 * Convert a GitWorktree to a Workspace object.
 * Used when syncing worktrees created outside the app.
 *
 * @param worktree - GitWorktree from git worktree list
 * @param settings - App settings (for default agent)
 */
export function gitWorktreeToWorkspace(
  worktree: GitWorktree,
  settings: Settings
): Workspace {
  // Extract branch name from refs/heads/feature format
  const branchName = worktree.branch
    ? worktree.branch.replace('refs/heads/', '')
    : 'detached';

  // Derive name from branch (use last segment for feature/xyz style)
  const nameParts = branchName.split('/');
  const name = nameParts[nameParts.length - 1];

  const now = new Date().toISOString();

  return {
    id: nanoid(),
    name,
    path: worktree.path,
    branch: branchName,
    agent: settings.defaultAgent,
    pid: undefined,
    createdAt: now,
    lastActiveAt: now,
  };
}
