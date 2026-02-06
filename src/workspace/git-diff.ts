// src/workspace/git-diff.ts
import { execa } from 'execa';

export interface FileDiff {
  path: string;
  status: 'M' | 'A' | 'D' | 'R'; // Modified, Added, Deleted, Renamed
  insertions: number;
  deletions: number;
  oldPath?: string; // For renames
}

export interface DiffSummary {
  workspaceId: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
  files: FileDiff[];
  timestamp: number;
  hasUncommittedChanges?: boolean; // True if there are uncommitted changes
}

/**
 * Detect the default branch dynamically
 * Finds the actual default branch name (could be main, master, develop, preprod, etc.)
 */
async function detectBaseBranch(workspacePath: string): Promise<string> {
  // Try to detect from origin/HEAD (tells us the default branch)
  try {
    const { stdout } = await execa('git', [
      'symbolic-ref',
      'refs/remotes/origin/HEAD',
      '--short',
    ], { cwd: workspacePath });

    if (stdout) {
      // Returns something like "origin/main" or "origin/preprod"
      // Strip the "origin/" prefix to get the branch name
      const remoteBranch = stdout.trim();
      const branchName = remoteBranch.replace(/^origin\//, '');
      return branchName;
    }
  } catch {
    // symbolic-ref failed, try to find default branch another way
  }

  // Fallback: list all remote branches and pick a likely default
  try {
    const { stdout } = await execa('git', [
      'branch',
      '-r',
      '--list',
      'origin/*',
    ], { cwd: workspacePath });

    const remoteBranches = stdout
      .split('\n')
      .map(b => b.trim().replace(/^origin\//, ''))
      .filter(b => b && b !== 'HEAD');

    // Try common default branch names in order
    const commonDefaults = ['main', 'master', 'preprod', 'develop', 'trunk'];
    for (const name of commonDefaults) {
      if (remoteBranches.includes(name)) {
        return name;
      }
    }

    // If none of the common names exist, use the first remote branch
    if (remoteBranches.length > 0) {
      return remoteBranches[0];
    }
  } catch {
    // Failed to list remote branches
  }

  // Absolute fallback
  return 'main';
}

/**
 * Get diff summary with file statistics
 * Compares against origin's main branch (e.g., origin/master)
 * Shows changes introduced by the workspace branch
 */
export async function getDiffSummary(
  workspaceId: string,
  workspacePath: string,
  baseBranch?: string
): Promise<DiffSummary> {
  try {
    // Detect base branch if not provided (local main or master)
    const localBase = baseBranch || await detectBaseBranch(workspacePath);

    // Use origin/${base} to compare against remote
    const base = `origin/${localBase}`;

    // Get diff statistics using --numstat
    // Three-dot syntax: shows changes from merge-base to HEAD
    const { stdout: numstatOutput } = await execa('git', [
      'diff',
      '--numstat',
      `${base}...HEAD`,
    ], { cwd: workspacePath });

    // Get file status (M/A/D/R)
    const { stdout: nameStatusOutput } = await execa('git', [
      'diff',
      '--name-status',
      `${base}...HEAD`,
    ], { cwd: workspacePath });

    // Parse the outputs
    const files = parseNumstat(numstatOutput, nameStatusOutput);

    // Calculate totals
    const insertions = files.reduce((sum, f) => sum + f.insertions, 0);
    const deletions = files.reduce((sum, f) => sum + f.deletions, 0);

    // Check for uncommitted changes if no committed changes
    let hasUncommittedChanges = false;
    if (files.length === 0) {
      try {
        const { stdout: uncommittedOutput } = await execa('git', [
          'diff',
          '--numstat',
          'HEAD',
        ], { cwd: workspacePath });

        hasUncommittedChanges = uncommittedOutput.trim().length > 0;
      } catch {
        // Failed to check uncommitted changes, ignore
      }
    }

    return {
      workspaceId,
      filesChanged: files.length,
      insertions,
      deletions,
      files,
      timestamp: Date.now(),
      hasUncommittedChanges,
    };
  } catch (error) {
    // Return empty diff on error (no changes, detached HEAD, etc.)
    return {
      workspaceId,
      filesChanged: 0,
      insertions: 0,
      deletions: 0,
      files: [],
      timestamp: Date.now(),
    };
  }
}

/**
 * Parse git diff --numstat and --name-status output
 */
function parseNumstat(numstatOutput: string, nameStatusOutput: string): FileDiff[] {
  if (!numstatOutput.trim()) {
    return [];
  }

  // Parse name-status first to get file status
  const statusMap = new Map<string, { status: string; oldPath?: string }>();
  const nameStatusLines = nameStatusOutput.trim().split('\n');

  for (const line of nameStatusLines) {
    const match = line.match(/^([MADR])\d*\s+(.+?)(?:\s+(.+))?$/);
    if (match) {
      const [, status, path, newPath] = match;
      if (status === 'R' && newPath) {
        // Rename: status is R, path is old, newPath is new
        statusMap.set(newPath, { status: 'R', oldPath: path });
      } else {
        statusMap.set(path, { status: status as 'M' | 'A' | 'D' });
      }
    }
  }

  // Parse numstat
  const files: FileDiff[] = [];
  const numstatLines = numstatOutput.trim().split('\n');

  for (const line of numstatLines) {
    // Format: <insertions>\t<deletions>\t<path>
    const parts = line.split('\t');
    if (parts.length < 3) continue;

    const insertions = parts[0] === '-' ? 0 : parseInt(parts[0], 10);
    const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10);
    const path = parts[2];

    // Get status from statusMap
    const statusInfo = statusMap.get(path);
    const status = (statusInfo?.status || 'M') as 'M' | 'A' | 'D' | 'R';

    files.push({
      path,
      status,
      insertions,
      deletions,
      oldPath: statusInfo?.oldPath,
    });
  }

  return files;
}

/**
 * Get detailed diff content for a single file
 * Compares against origin's main branch
 */
export async function getFileDiff(
  workspacePath: string,
  filePath: string,
  baseBranch?: string
): Promise<string> {
  try {
    const localBase = baseBranch || await detectBaseBranch(workspacePath);

    // Use origin/${base} to compare against remote
    const base = `origin/${localBase}`;

    const { stdout } = await execa('git', [
      'diff',
      `${base}...HEAD`,
      '--',
      filePath,
    ], { cwd: workspacePath });

    return stdout;
  } catch (error) {
    return `Error loading diff: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/**
 * Format diff summary for display (e.g., "3 files, +45/-12")
 */
export function formatDiffSummary(diff: DiffSummary): string {
  if (diff.filesChanged === 0) {
    return 'No changes';
  }

  const fileText = diff.filesChanged === 1 ? 'file' : 'files';
  return `${diff.filesChanged} ${fileText}, +${diff.insertions}/-${diff.deletions}`;
}
