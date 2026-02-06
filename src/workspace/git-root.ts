// src/workspace/git-root.ts
import { execSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

/**
 * Detect if the current directory is inside a git repository.
 * Returns the repository root path if found, null otherwise.
 */
export function detectGitRoot(): string | null {
  try {
    // Get git root directory (handles being in subdirectories)
    const output = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd(),
    });

    const rootPath = output.trim();

    // Resolve symlinks to get real path (matches what git worktree list returns)
    return realpathSync(rootPath);
  } catch {
    // Not in a git repository or git not available
    return null;
  }
}
