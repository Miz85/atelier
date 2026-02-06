// src/state/workspace.ts
import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { createJotaiStorage } from '../config/storage.js';

/**
 * Workspace represents an isolated coding agent workspace.
 * Each workspace has its own git worktree and agent instance.
 */
export interface Workspace {
  id: string;                        // Unique identifier (UUID)
  name: string;                      // User-friendly name
  path: string;                      // Filesystem path to worktree
  branch: string;                    // Git branch name
  agent: 'claude' | 'opencode';      // Agent type for this workspace
  pid?: number;                      // Agent process ID (if running)
  createdAt: string;                 // ISO timestamp
  lastActiveAt: string;              // ISO timestamp
}

/**
 * Persistent atom for all workspaces.
 * Persists to ~/.atelier/state/workspaces.json
 */
export const workspacesAtom = atomWithStorage<Workspace[]>(
  'workspaces',
  [],
  createJotaiStorage<Workspace[]>(),
  { getOnInit: true } // Load from disk on initialization
);

/**
 * Persisted atom for the currently active workspace ID.
 * null means no workspace is active.
 * Persists to ~/.atelier/state/activeWorkspaceId.json
 */
export const activeWorkspaceIdAtom = atomWithStorage<string | null>(
  'activeWorkspaceId',
  null,
  createJotaiStorage<string | null>(),
  { getOnInit: true }
);

/**
 * Derived atom that returns the full Workspace object for the active workspace.
 * Returns null if no workspace is active or if the active ID doesn't match any workspace.
 */
export const activeWorkspaceAtom = atom((get) => {
  const workspaces = get(workspacesAtom);
  const activeId = get(activeWorkspaceIdAtom);

  if (!activeId) return null;

  return workspaces.find(w => w.id === activeId) ?? null;
});

/**
 * Persisted atom for the current repository path.
 * Set when user opens a repository.
 * Used for git operations and workspace path computation.
 */
export const repoPathAtom = atomWithStorage<string | null>(
  'repoPath',
  null,
  createJotaiStorage<string | null>(),
  { getOnInit: true }
);

/**
 * Helper to set active workspace by ID.
 * Use this from components: setActiveWorkspace(set, workspaceId)
 */
export function setActiveWorkspace(
  set: (atom: typeof activeWorkspaceIdAtom, value: string | null) => void,
  workspaceId: string | null
): void {
  set(activeWorkspaceIdAtom, workspaceId);
}
