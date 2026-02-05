// src/state/diff.ts
import { atom } from 'jotai';
import { atomFamily } from 'jotai/utils';
import type { DiffSummary } from '../workspace/git-diff.js';

/**
 * Per-workspace diff summary (cached)
 * Uses atom family pattern like agent state
 */
export const workspaceDiffSummaryAtomFamily = atomFamily(
  (workspaceId: string) => atom<DiffSummary | null>(null)
);

/**
 * Loading state for diff calculations
 */
export const diffLoadingAtomFamily = atomFamily(
  (workspaceId: string) => atom<boolean>(false)
);

/**
 * State for the detailed diff view
 */
export interface DiffViewState {
  workspaceId: string;
  selectedFilePath: string | null;
  selectedFileContent: string | null;
}

export const diffViewStateAtom = atom<DiffViewState | null>(null);

/**
 * Helper atom to get diff summary for a workspace
 */
export function getDiffSummaryAtom(workspaceId: string) {
  return workspaceDiffSummaryAtomFamily(workspaceId);
}

/**
 * Helper atom to get loading state for a workspace
 */
export function getDiffLoadingAtom(workspaceId: string) {
  return diffLoadingAtomFamily(workspaceId);
}
