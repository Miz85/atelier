// src/state/workspace.ts
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
 * Persists to ~/.equipe/state/workspaces.json
 */
export const workspacesAtom = atomWithStorage<Workspace[]>(
  'workspaces',
  [],
  createJotaiStorage<Workspace[]>(),
  { getOnInit: true } // Load from disk on initialization
);
