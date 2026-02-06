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
}

/**
 * Detect the local main branch (main or master)
 * Compares against local main branch for fast, offline diffs
 */
async function detectBaseBranch(workspacePath: string): Promise<string> {
  // Try local main first (most common)
  try {
    await execa('git', ['rev-parse', '--verify', 'main'], { cwd: workspacePath });
    return 'main';
  } catch {
    // main doesn't exist
  }

  // Fall back to local master
  try {
    await execa('git', ['rev-parse', '--verify', 'master'], { cwd: workspacePath });
    return 'master';
  } catch {
    // master doesn't exist either
  }

  // Absolute fallback
  return 'main';
}

/**
 * Get diff summary with file statistics
 * Compares current branch HEAD to local main (or master)
 */
export async function getDiffSummary(
  workspaceId: string,
  workspacePath: string,
  baseBranch?: string
): Promise<DiffSummary> {
  try {
    // Detect base branch if not provided (local main or master)
    const base = baseBranch || await detectBaseBranch(workspacePath);

    // Get diff statistics using --numstat
    // Compare local main to current HEAD
    const { stdout: numstatOutput } = await execa('git', [
      'diff',
      '--numstat',
      base,
      'HEAD',
    ], { cwd: workspacePath });

    // Get file status (M/A/D/R)
    const { stdout: nameStatusOutput } = await execa('git', [
      'diff',
      '--name-status',
      base,
      'HEAD',
    ], { cwd: workspacePath });

    // Parse the outputs
    const files = parseNumstat(numstatOutput, nameStatusOutput);

    // Calculate totals
    const insertions = files.reduce((sum, f) => sum + f.insertions, 0);
    const deletions = files.reduce((sum, f) => sum + f.deletions, 0);

    return {
      workspaceId,
      filesChanged: files.length,
      insertions,
      deletions,
      files,
      timestamp: Date.now(),
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
 * Compares local main to current HEAD
 */
export async function getFileDiff(
  workspacePath: string,
  filePath: string,
  baseBranch?: string
): Promise<string> {
  try {
    const base = baseBranch || await detectBaseBranch(workspacePath);

    const { stdout } = await execa('git', [
      'diff',
      base,
      'HEAD',
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
