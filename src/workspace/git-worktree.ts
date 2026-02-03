// src/workspace/git-worktree.ts
import { $ } from 'execa';

/**
 * Represents a git worktree entry.
 */
export interface GitWorktree {
  path: string;           // Absolute path to worktree directory
  head: string;           // Current HEAD commit SHA
  branch: string | null;  // Branch name (refs/heads/...) or null if detached
  bare: boolean;
  detached: boolean;
  locked: boolean;
  prunable: boolean;
}

/**
 * List all worktrees in a git repository.
 * Parses `git worktree list --porcelain` output.
 *
 * @param repoPath - Absolute path to the git repository
 * @returns Array of GitWorktree objects
 */
export async function listWorktrees(repoPath: string): Promise<GitWorktree[]> {
  try {
    const result = await $({ cwd: repoPath })`git worktree list --porcelain`;
    return parseWorktreePorcelain(result.stdout);
  } catch (error: any) {
    throw new Error(`Failed to list worktrees: ${error.stderr || error.message}`);
  }
}

/**
 * Parse git worktree list --porcelain output.
 * Format: blocks separated by empty lines, each block contains key-value pairs.
 *
 * Example:
 * worktree /path/to/repo
 * HEAD abc123...
 * branch refs/heads/main
 *
 * worktree /path/to/worktree
 * HEAD def456...
 * branch refs/heads/feature
 * detached
 */
function parseWorktreePorcelain(output: string): GitWorktree[] {
  const worktrees: GitWorktree[] = [];
  const blocks = output.trim().split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.split('\n');
    const worktree: Partial<GitWorktree> = {
      bare: false,
      detached: false,
      locked: false,
      prunable: false,
      branch: null,
    };

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        worktree.path = line.substring('worktree '.length);
      } else if (line.startsWith('HEAD ')) {
        worktree.head = line.substring('HEAD '.length);
      } else if (line.startsWith('branch ')) {
        worktree.branch = line.substring('branch '.length);
      } else if (line === 'bare') {
        worktree.bare = true;
      } else if (line === 'detached') {
        worktree.detached = true;
      } else if (line.startsWith('locked')) {
        worktree.locked = true;
      } else if (line.startsWith('prunable')) {
        worktree.prunable = true;
      }
    }

    if (worktree.path && worktree.head !== undefined) {
      worktrees.push(worktree as GitWorktree);
    }
  }

  return worktrees;
}

/**
 * Get the default branch name for a repository.
 * Tries remote HEAD first, falls back to local HEAD, then common defaults.
 *
 * @param repoPath - Absolute path to the git repository
 * @returns The default branch name (e.g., 'main', 'master', 'preprod')
 */
export async function getDefaultBranch(repoPath: string): Promise<string> {
  // Try to get default branch from remote HEAD (most reliable for repos with remotes)
  try {
    const result = await $({ cwd: repoPath })`git symbolic-ref refs/remotes/origin/HEAD`;
    // Returns something like "refs/remotes/origin/main"
    const ref = result.stdout.trim();
    const branch = ref.replace('refs/remotes/origin/', '');
    if (branch) return branch;
  } catch {
    // No remote HEAD set, try other methods
  }

  // Try to detect from remote tracking branches
  try {
    const result = await $({ cwd: repoPath })`git remote show origin`;
    const match = result.stdout.match(/HEAD branch:\s*(\S+)/);
    if (match && match[1]) return match[1];
  } catch {
    // No remote or can't connect
  }

  // Fall back to local HEAD branch
  try {
    const result = await $({ cwd: repoPath })`git symbolic-ref --short HEAD`;
    const branch = result.stdout.trim();
    if (branch) return branch;
  } catch {
    // Detached HEAD or other issue
  }

  // Last resort: check for common default branches
  try {
    const result = await $({ cwd: repoPath })`git branch -l main master preprod develop`;
    const branches = result.stdout.trim().split('\n').map(b => b.replace(/^\*?\s*/, ''));
    for (const preferred of ['main', 'master', 'preprod', 'develop']) {
      if (branches.includes(preferred)) return preferred;
    }
  } catch {
    // Branch list failed
  }

  // Give up and return 'main' as default
  return 'main';
}

/**
 * Add a new worktree with a new branch.
 *
 * @param repoPath - Absolute path to the git repository
 * @param worktreePath - Absolute path where the new worktree should be created
 * @param branchName - Name for the new branch (will be created)
 * @param baseBranch - Base branch to branch from (auto-detected if not provided)
 */
export async function addWorktree(
  repoPath: string,
  worktreePath: string,
  branchName: string,
  baseBranch?: string
): Promise<void> {
  try {
    // Fetch latest refs from origin to ensure we have the base branch
    try {
      await $({ cwd: repoPath })`git fetch origin`;
    } catch (fetchError: any) {
      // If fetch fails (no remote, no network), continue anyway
      // The worktree add will fail if the base branch doesn't exist locally
      console.warn(`Warning: git fetch failed: ${fetchError.stderr || fetchError.message}`);
    }

    // Auto-detect default branch if not specified
    const targetBranch = baseBranch ?? await getDefaultBranch(repoPath);

    // Add worktree with new branch based on origin/baseBranch
    await $({ cwd: repoPath })`git worktree add -b ${branchName} ${worktreePath} origin/${targetBranch}`;
  } catch (error: any) {
    const stderr = error.stderr || '';

    if (stderr.includes("already exists")) {
      throw new Error(`Failed to create worktree: branch '${branchName}' already exists`);
    } else if (stderr.includes("is already checked out")) {
      throw new Error(`Failed to create worktree: branch '${branchName}' is already checked out in another worktree`);
    } else if (stderr.includes("invalid reference")) {
      throw new Error(`Failed to create worktree: base branch 'origin/${baseBranch}' does not exist`);
    } else {
      throw new Error(`Failed to create worktree: ${stderr || error.message}`);
    }
  }
}

/**
 * Remove a worktree.
 * Does NOT use --force, allowing git to protect uncommitted changes.
 *
 * @param repoPath - Absolute path to the git repository
 * @param worktreePath - Absolute path to the worktree to remove
 */
export async function removeWorktree(
  repoPath: string,
  worktreePath: string
): Promise<void> {
  try {
    await $({ cwd: repoPath })`git worktree remove ${worktreePath}`;
  } catch (error: any) {
    const stderr = error.stderr || '';

    if (stderr.includes("contains modified or untracked files")) {
      throw new Error(
        `Failed to remove worktree: ${worktreePath} contains uncommitted changes. ` +
        `Commit or discard changes before removing.`
      );
    } else {
      throw new Error(`Failed to remove worktree: ${stderr || error.message}`);
    }
  }
}

/**
 * Delete a git branch.
 * Used to clean up branches after removing their worktrees.
 *
 * @param repoPath - Absolute path to the git repository
 * @param branchName - Name of the branch to delete
 * @param force - Use -D (force delete) instead of -d (default: false)
 */
export async function deleteBranch(
  repoPath: string,
  branchName: string,
  force: boolean = false
): Promise<void> {
  try {
    const flag = force ? '-D' : '-d';
    await $({ cwd: repoPath })`git branch ${flag} ${branchName}`;
  } catch (error: any) {
    const stderr = error.stderr || '';

    if (stderr.includes("not fully merged")) {
      throw new Error(
        `Failed to delete branch '${branchName}': branch is not fully merged. ` +
        `Use force delete to remove anyway.`
      );
    } else if (stderr.includes("not found")) {
      // Branch doesn't exist, that's fine
      return;
    } else {
      throw new Error(`Failed to delete branch: ${stderr || error.message}`);
    }
  }
}
