# Phase 2: Workspace Management - Research

**Researched:** 2026-02-02
**Domain:** Git worktree management, multi-process PTY orchestration, workspace state synchronization
**Confidence:** HIGH

## Summary

Phase 2 builds workspace management on top of Phase 1's foundation (process registry, PTY manager, Jotai persistence). The core challenge is synchronizing git worktree state with application state while managing agent processes across multiple isolated directories. Research focused on three domains: git worktree operations in Node.js, agent process launching (Claude Code and OpenCode), and workspace state management patterns.

The recommended approach uses `execa` for git worktree commands (better than simple-git which lacks native worktree methods), the existing `BufferedPtyProcess` from Phase 1 for agent launching, and Jotai atoms for workspace state with careful synchronization to prevent drift between git worktrees and app state.

Key finding: Git's `--porcelain` output format for `git worktree list` provides stable, parseable output that should be the source of truth. App state should sync FROM git state, not the reverse, to handle manual worktree operations outside the app.

**Primary recommendation:** Use execa for git worktree CLI operations with `--porcelain` parsing, launch agents via existing PTY manager with cwd set to worktree path, implement bidirectional sync between git worktree state and Jotai workspace atoms.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| execa | 9.x | Execute git worktree commands | Promise-based, TypeScript types, automatic cleanup, no shell injection risk, handles Windows |
| node-pty | 1.1.0 | Agent process management (existing) | Already in Phase 1, handles PTY for Claude/OpenCode |
| Jotai | 2.17.x | Workspace state atoms (existing) | Already in Phase 1 with persistence |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| nanoid | 5.x | Generate workspace IDs | Short, URL-safe, collision-resistant IDs |
| (none needed) | - | Git worktree parsing | Use native git CLI with --porcelain, no library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| execa | simple-git | simple-git lacks native worktree methods, requires .raw() for worktree commands |
| execa | git-worktree npm | Last updated 2021, only 0.2.1, minimal maintenance |
| nanoid | uuid | UUID is longer (36 chars), nanoid is 21 chars, both collision-resistant |

**Installation:**
```bash
npm install execa@^9 nanoid@^5
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── workspace/           # NEW: Workspace management
│   ├── git-worktree.ts  # Git worktree operations (add, list, remove)
│   ├── workspace-manager.ts  # Orchestrates worktree + agent lifecycle
│   ├── agent-launcher.ts     # Launch Claude/OpenCode in worktree
│   └── sync.ts               # Sync git state <-> app state
├── state/
│   └── workspace.ts     # EXISTING: Jotai atoms (extend with active workspace)
├── processes/           # EXISTING from Phase 1
│   ├── pty-manager.ts   # Reuse for agent processes
│   └── cleanup.ts       # Process registry
└── components/          # TUI components
    ├── WorkspaceList.tsx    # List/select workspaces
    ├── CreateWorkspace.tsx  # Create workspace form
    └── WorkspaceDetail.tsx  # Show workspace info
```

### Pattern 1: Git Worktree Operations via Execa
**What:** Wrapper around git CLI for worktree operations
**When to use:** All git worktree add/list/remove operations
**Example:**
```typescript
// Source: https://git-scm.com/docs/git-worktree (--porcelain format)
// Source: https://github.com/sindresorhus/execa (execa API)

import { $ } from 'execa';

interface GitWorktree {
  path: string;
  head: string;
  branch: string | null;
  bare: boolean;
  detached: boolean;
  locked: boolean;
  prunable: boolean;
}

/**
 * List all git worktrees using stable --porcelain format.
 * Porcelain format is guaranteed stable across git versions.
 */
async function listWorktrees(repoPath: string): Promise<GitWorktree[]> {
  const { stdout } = await $({ cwd: repoPath })`git worktree list --porcelain`;

  // Parse porcelain output (blocks separated by empty lines)
  const blocks = stdout.split('\n\n').filter(Boolean);

  return blocks.map(block => {
    const lines = block.split('\n');
    const worktree: GitWorktree = {
      path: '',
      head: '',
      branch: null,
      bare: false,
      detached: false,
      locked: false,
      prunable: false,
    };

    for (const line of lines) {
      if (line.startsWith('worktree ')) worktree.path = line.slice(9);
      else if (line.startsWith('HEAD ')) worktree.head = line.slice(5);
      else if (line.startsWith('branch ')) worktree.branch = line.slice(7);
      else if (line === 'bare') worktree.bare = true;
      else if (line === 'detached') worktree.detached = true;
      else if (line.startsWith('locked')) worktree.locked = true;
      else if (line.startsWith('prunable')) worktree.prunable = true;
    }

    return worktree;
  });
}

/**
 * Create a new worktree with a new branch.
 */
async function addWorktree(
  repoPath: string,
  worktreePath: string,
  branchName: string,
  baseBranch: string = 'main'
): Promise<void> {
  // Fetch to ensure we have latest refs
  await $({ cwd: repoPath })`git fetch origin`;

  // Create worktree with new branch based on origin/baseBranch
  await $({ cwd: repoPath })`git worktree add -b ${branchName} ${worktreePath} origin/${baseBranch}`;
}

/**
 * Remove a worktree (git handles directory deletion).
 */
async function removeWorktree(repoPath: string, worktreePath: string): Promise<void> {
  // --force handles untracked files; remove carefully
  await $({ cwd: repoPath })`git worktree remove ${worktreePath}`;
}
```

### Pattern 2: Agent Launcher Using Existing PTY Manager
**What:** Launch Claude Code or OpenCode in a worktree directory
**When to use:** When user activates a workspace
**Example:**
```typescript
// Source: Claude Code docs https://code.claude.com/docs/en/quickstart
// Source: OpenCode docs https://opencode.ai/docs/cli/

import { BufferedPtyProcess, spawnPty } from '../processes/pty-manager.js';
import { processRegistry } from '../processes/cleanup.js';
import type { Workspace } from '../state/workspace.js';

type AgentType = 'claude' | 'opencode';

interface AgentProcess {
  workspace: Workspace;
  pty: BufferedPtyProcess;
}

/**
 * Launch an agent in the workspace directory.
 * Uses existing PTY manager from Phase 1.
 */
function launchAgent(workspace: Workspace): AgentProcess {
  const command = workspace.agent === 'claude' ? 'claude' : 'opencode';

  // Both agents accept working directory as implicit cwd
  const pty = spawnPty(command, [], {
    cwd: workspace.path,  // Worktree path
    env: {
      ...process.env,
      // Ensure agents see a proper terminal
      TERM: 'xterm-256color',
    },
  });

  return { workspace, pty };
}

/**
 * Gracefully stop an agent process.
 */
async function stopAgent(agent: AgentProcess): Promise<void> {
  if (!agent.pty.hasExited) {
    // Send Ctrl+C first (graceful)
    agent.pty.write('\x03');

    // Wait briefly for graceful exit
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Force kill if still running
    if (!agent.pty.hasExited) {
      agent.pty.kill('SIGTERM');
    }
  }
}
```

### Pattern 3: Workspace State Synchronization
**What:** Keep Jotai workspace atoms in sync with actual git worktree state
**When to use:** On app startup and after any worktree operation
**Example:**
```typescript
// Source: Derived from Phase 1 patterns and git worktree research

import { atom } from 'jotai';
import { workspacesAtom, type Workspace } from '../state/workspace.js';
import { listWorktrees, type GitWorktree } from './git-worktree.js';

/**
 * Derived atom for active workspace.
 * Single source of truth for which workspace is currently selected.
 */
export const activeWorkspaceIdAtom = atom<string | null>(null);

export const activeWorkspaceAtom = atom((get) => {
  const workspaces = get(workspacesAtom);
  const activeId = get(activeWorkspaceIdAtom);
  return workspaces.find(w => w.id === activeId) ?? null;
});

/**
 * Sync app state FROM git worktree state.
 * Git worktrees are source of truth for paths/branches.
 * App state adds metadata (id, name, agent type, timestamps).
 *
 * Call on:
 * - App startup
 * - After creating/removing worktrees
 * - Periodically to catch external changes
 */
async function syncWorkspacesFromGit(
  repoPath: string,
  currentWorkspaces: Workspace[]
): Promise<{
  toAdd: GitWorktree[];
  toRemove: Workspace[];
  unchanged: Workspace[];
}> {
  const gitWorktrees = await listWorktrees(repoPath);

  // Build lookup by path (path is unique identifier in git)
  const gitPaths = new Set(gitWorktrees.map(w => w.path));
  const appPaths = new Map(currentWorkspaces.map(w => [w.path, w]));

  // Worktrees in git but not in app -> need to add
  const toAdd = gitWorktrees.filter(gw => !appPaths.has(gw.path));

  // Workspaces in app but not in git -> need to remove
  const toRemove = currentWorkspaces.filter(w => !gitPaths.has(w.path));

  // Both exist -> unchanged (may need branch update)
  const unchanged = currentWorkspaces.filter(w => gitPaths.has(w.path));

  return { toAdd, toRemove, unchanged };
}
```

### Pattern 4: Workspace Lifecycle Orchestration
**What:** Coordinate worktree creation, agent launch, and state updates
**When to use:** Create/delete workspace operations
**Example:**
```typescript
// Full lifecycle: create worktree -> update state -> launch agent

import { nanoid } from 'nanoid';
import type { Workspace } from '../state/workspace.js';

interface CreateWorkspaceOptions {
  repoPath: string;
  branchName: string;
  name?: string;       // User-friendly name, defaults to branch
  agent?: 'claude' | 'opencode';
  baseBranch?: string;
}

async function createWorkspace(
  options: CreateWorkspaceOptions,
  currentWorkspaces: Workspace[]
): Promise<Workspace> {
  const {
    repoPath,
    branchName,
    name = branchName,
    agent = 'claude',  // Default from settings
    baseBranch = 'main',
  } = options;

  // Generate workspace ID
  const id = nanoid();

  // Determine worktree path (sibling to main repo)
  // Pattern: /path/to/repo -> /path/to/repo-branchname
  const worktreePath = `${repoPath}-${branchName.replace(/\//g, '-')}`;

  // 1. Create git worktree
  await addWorktree(repoPath, worktreePath, branchName, baseBranch);

  // 2. Create workspace record
  const now = new Date().toISOString();
  const workspace: Workspace = {
    id,
    name,
    path: worktreePath,
    branch: branchName,
    agent,
    pid: undefined,  // Not running yet
    createdAt: now,
    lastActiveAt: now,
  };

  return workspace;
}

async function deleteWorkspace(
  workspace: Workspace,
  repoPath: string
): Promise<void> {
  // 1. Stop agent if running
  if (workspace.pid) {
    // Use process registry from Phase 1
    processRegistry.cleanup();  // Or targeted kill
  }

  // 2. Remove git worktree
  await removeWorktree(repoPath, workspace.path);

  // 3. State update happens in caller (remove from workspacesAtom)
}
```

### Anti-Patterns to Avoid

- **Manual directory deletion:** Always use `git worktree remove`, never `rm -rf`. Manual deletion leaves stale entries in `.git/worktrees/` that cause errors. Run `git worktree prune` if manual deletion occurred.

- **Trusting app state over git state:** App state can get stale (crashed before saving, manual git operations). Always sync FROM git worktree list, not the reverse.

- **Same branch in multiple worktrees:** Git forbids checking out the same branch in multiple worktrees. Validate before creating.

- **Blocking UI during git operations:** Git operations (especially fetch, clone) can be slow. Use async patterns, show loading state.

- **Not handling worktree path with spaces:** Paths with spaces need proper quoting. Execa handles this automatically (no shell injection).

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Git worktree operations | Shell exec with string interpolation | execa with template strings | Shell injection risk, quoting issues, Windows compatibility |
| Parsing git output | Regex on default output | `--porcelain` flag | Porcelain is stable across versions, human output changes |
| Process tree cleanup | process.kill() on single PID | terminate package (existing) | Agents spawn children, need tree kill |
| Unique IDs | Math.random or timestamp | nanoid | Collision-resistant, URL-safe, short |
| PTY management | Raw child_process.spawn | node-pty (existing) | Proper terminal emulation needed for agents |

**Key insight:** Git worktree operations are fundamentally CLI-based. There's no official Node.js library because the git CLI with `--porcelain` output is already the stable API. Use execa to call git directly rather than searching for incomplete wrapper libraries.

## Common Pitfalls

### Pitfall 1: Branch Already Checked Out
**What goes wrong:** `git worktree add` fails with "fatal: 'branch-name' is already checked out at '/path'"
**Why it happens:** Git enforces that each branch can only be checked out in one worktree at a time.
**How to avoid:**
1. Before creating worktree, check if branch exists in any worktree
2. Use `--force` flag only if you truly want to detach the other worktree
3. Better: Always create new branches for new worktrees, based on remote tracking branch
**Warning signs:**
- User tries to create workspace with existing branch name
- Error message mentions "already checked out"

### Pitfall 2: Stale Worktree References
**What goes wrong:** `git worktree list` shows worktrees that don't exist on disk. Operations fail with confusing errors.
**Why it happens:** Worktree directory was manually deleted instead of using `git worktree remove`.
**How to avoid:**
1. Always use `git worktree remove` for deletion
2. On app startup, run `git worktree prune` to clean stale entries
3. Handle errors gracefully when worktree path doesn't exist
**Warning signs:**
- Worktree in list but path returns ENOENT
- Operations fail on "missing" worktrees

### Pitfall 3: Workspace State Drift
**What goes wrong:** App shows workspaces that don't exist in git, or git has worktrees the app doesn't know about.
**Why it happens:** User ran git worktree commands outside the app, or app crashed before persisting state.
**How to avoid:**
1. On startup, sync app state FROM git worktree list
2. After any worktree operation, re-sync from git
3. Show "unknown" worktrees found in git that aren't in app state
**Warning signs:**
- Clicking workspace fails because path doesn't exist
- New worktrees created externally don't appear

### Pitfall 4: Agent Process Orphaning
**What goes wrong:** Agent process keeps running after workspace deleted, or multiple agents for same workspace.
**Why it happens:** PID not tracked in workspace state, or delete didn't kill process first.
**How to avoid:**
1. Store agent PID in workspace state when launched
2. Before removing worktree, terminate agent process
3. On app startup, check if stored PIDs are still running (process.kill(pid, 0))
4. Use process registry from Phase 1 for cleanup on exit
**Warning signs:**
- `ps aux | grep claude` shows orphaned processes
- Workspace shows "running" but can't send input

### Pitfall 5: node_modules Per Worktree
**What goes wrong:** Each worktree has independent node_modules, consuming disk space and requiring separate installs.
**Why it happens:** Git worktrees share .git but not working directory files.
**How to avoid:**
1. Document this is expected behavior (not a bug)
2. Consider pnpm which shares packages across projects
3. Optionally: Prompt to run `npm install` when entering worktree first time
**Warning signs:**
- Users confused about missing dependencies
- Disk usage grows with each workspace

### Pitfall 6: IDE/Tooling Conflicts
**What goes wrong:** Language servers, file watchers, or IDE extensions behave unexpectedly with multiple worktrees.
**Why it happens:** Some tools assume single working directory per repo, or watch .git which is shared.
**How to avoid:**
1. Document that users should configure IDE per-worktree
2. The agent (Claude/OpenCode) operates in isolated worktree, avoiding most conflicts
3. Each workspace launches its own agent instance
**Warning signs:**
- LSP shows wrong file contents
- File changes in one worktree trigger rebuilds in another

## Code Examples

Verified patterns from official sources:

### Git Worktree Add with New Branch
```typescript
// Source: https://git-scm.com/docs/git-worktree
// Source: https://github.com/sindresorhus/execa

import { $ } from 'execa';

async function createWorktreeWithBranch(
  repoPath: string,
  worktreePath: string,
  newBranch: string,
  startPoint: string = 'origin/main'
): Promise<void> {
  try {
    // Fetch latest to ensure startPoint exists
    await $({ cwd: repoPath })`git fetch origin`;

    // Create worktree with new branch
    // -b creates new branch, startPoint is where branch starts from
    await $({ cwd: repoPath })`git worktree add -b ${newBranch} ${worktreePath} ${startPoint}`;

    console.log(`Created worktree at ${worktreePath} with branch ${newBranch}`);
  } catch (error) {
    if (error.stderr?.includes('already exists')) {
      throw new Error(`Branch '${newBranch}' already exists`);
    }
    if (error.stderr?.includes('already checked out')) {
      throw new Error(`Branch '${newBranch}' is already checked out in another worktree`);
    }
    throw error;
  }
}
```

### Launch Claude Code in Worktree
```typescript
// Source: https://code.claude.com/docs/en/quickstart

import { spawnPty } from '../processes/pty-manager.js';

function launchClaude(worktreePath: string): BufferedPtyProcess {
  // Claude Code uses cwd as project root
  // No arguments needed for interactive mode
  const pty = spawnPty('claude', [], {
    cwd: worktreePath,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
    },
  });

  // Log output for debugging
  pty.on({
    onData: (data) => {
      // Forward to TUI or buffer for display
    },
    onExit: (code) => {
      console.log(`Claude exited with code ${code}`);
    },
  });

  return pty;
}
```

### Launch OpenCode in Worktree
```typescript
// Source: https://opencode.ai/docs/cli/

import { spawnPty } from '../processes/pty-manager.js';

function launchOpenCode(worktreePath: string): BufferedPtyProcess {
  // OpenCode accepts project path as argument
  const pty = spawnPty('opencode', [worktreePath], {
    cwd: worktreePath,  // Also set cwd for consistency
    env: {
      ...process.env,
      TERM: 'xterm-256color',
    },
  });

  return pty;
}
```

### Parse Git Worktree List (Porcelain Format)
```typescript
// Source: https://git-scm.com/docs/git-worktree (--porcelain section)

interface ParsedWorktree {
  path: string;
  head: string;
  branch: string | null;  // null if detached HEAD
  bare: boolean;
  detached: boolean;
  locked: boolean;
  lockedReason?: string;
  prunable: boolean;
  prunableReason?: string;
}

function parseWorktreeListPorcelain(output: string): ParsedWorktree[] {
  // Porcelain format: blocks separated by empty lines
  // Each block has key-value lines (key space value) or flags (single word)
  const blocks = output.trim().split('\n\n');

  return blocks.map(block => {
    const lines = block.split('\n');
    const wt: ParsedWorktree = {
      path: '',
      head: '',
      branch: null,
      bare: false,
      detached: false,
      locked: false,
      prunable: false,
    };

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        wt.path = line.slice(9);
      } else if (line.startsWith('HEAD ')) {
        wt.head = line.slice(5);
      } else if (line.startsWith('branch ')) {
        wt.branch = line.slice(7);  // refs/heads/branch-name
      } else if (line === 'bare') {
        wt.bare = true;
      } else if (line === 'detached') {
        wt.detached = true;
      } else if (line === 'locked') {
        wt.locked = true;
      } else if (line.startsWith('locked ')) {
        wt.locked = true;
        wt.lockedReason = line.slice(7);
      } else if (line === 'prunable') {
        wt.prunable = true;
      } else if (line.startsWith('prunable ')) {
        wt.prunable = true;
        wt.prunableReason = line.slice(9);
      }
    }

    return wt;
  });
}
```

### Workspace State Atom with Active Selection
```typescript
// Extend existing workspace.ts from Phase 1

import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { createJotaiStorage } from '../config/storage.js';

// Existing from Phase 1
export interface Workspace {
  id: string;
  name: string;
  path: string;
  branch: string;
  agent: 'claude' | 'opencode';
  pid?: number;
  createdAt: string;
  lastActiveAt: string;
}

export const workspacesAtom = atomWithStorage<Workspace[]>(
  'workspaces',
  [],
  createJotaiStorage<Workspace[]>(),
  { getOnInit: true }
);

// NEW: Active workspace tracking (persisted)
export const activeWorkspaceIdAtom = atomWithStorage<string | null>(
  'activeWorkspaceId',
  null,
  createJotaiStorage<string | null>(),
  { getOnInit: true }
);

// Derived: Get active workspace object
export const activeWorkspaceAtom = atom((get) => {
  const workspaces = get(workspacesAtom);
  const activeId = get(activeWorkspaceIdAtom);
  if (!activeId) return null;
  return workspaces.find(w => w.id === activeId) ?? null;
});

// Derived: Workspaces with running agents
export const runningWorkspacesAtom = atom((get) => {
  const workspaces = get(workspacesAtom);
  return workspaces.filter(w => w.pid !== undefined);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| simple-git .raw() for worktree | execa with git CLI directly | Ongoing | simple-git has no native worktree methods, execa is cleaner |
| Parse human-readable git output | Use --porcelain flag | Git feature | Porcelain output is stable API, human output changes |
| child_process for CLI tools | execa 9.x | 2024 | Better Windows support, auto cleanup, TypeScript types |
| isomorphic-git | Native git CLI | Ongoing | isomorphic-git has known worktree issues (see GitHub issue) |

**Deprecated/outdated:**
- **git-worktree npm package:** Last updated 2021, minimal maintenance, use execa + git CLI instead
- **isomorphic-git for worktrees:** Known issues with worktree support, doesn't properly handle .git file links

## Open Questions

Things that couldn't be fully resolved:

1. **Worktree path strategy**
   - What we know: Can place worktrees anywhere, common pattern is sibling directories
   - What's unclear: Should we use user-configurable base path or always sibling to main repo?
   - Recommendation: Default to sibling (`/repo-branchname`), allow override in settings

2. **Handling repos the user opens that aren't cloned yet**
   - What we know: Phase 2 assumes working with existing repos
   - What's unclear: Should we support cloning? That's additional complexity
   - Recommendation: Defer to future phase, require repo to exist first

3. **Worktree cleanup on uninstall**
   - What we know: Worktrees persist on filesystem independent of app
   - What's unclear: Should app cleanup all worktrees on uninstall? User might want to keep them
   - Recommendation: Don't auto-cleanup, document that worktrees persist

4. **Multiple repos support**
   - What we know: Each repo has its own set of worktrees
   - What's unclear: How to handle workspaces across different repos in the UI?
   - Recommendation: Group workspaces by repo, allow switching active repo

## Sources

### Primary (HIGH confidence)
- Git Worktree Documentation: https://git-scm.com/docs/git-worktree (porcelain format, all commands)
- Execa GitHub: https://github.com/sindresorhus/execa (v9 features, TypeScript)
- Claude Code Quickstart: https://code.claude.com/docs/en/quickstart (launch command, cwd usage)
- OpenCode CLI Docs: https://opencode.ai/docs/cli/ (launch options, working directory)
- Node.js Child Process: https://nodejs.org/api/child_process.html (subprocess management)

### Secondary (MEDIUM confidence)
- Git Worktree Gotchas: https://joshtune.com/posts/git-worktree-pros-cons/ (pitfalls, anti-patterns)
- Execa 9 Release: https://medium.com/@ehmicky/execa-9-release-d0d5daaa097f (new features)
- Git Worktree Best Practices: https://gist.github.com/induratized/49cdedace4a200fa8ae32db9ba3e9a44

### Tertiary (LOW confidence)
- WebSearch: "git worktree Node.js API library 2026" - found git-worktree npm but outdated
- WebSearch: "simple-git worktree support" - confirmed no native methods

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - execa is well-documented, git --porcelain is official stable API
- Architecture: HIGH - patterns derived from Phase 1 foundation + official git/agent docs
- Pitfalls: HIGH - documented in multiple sources, git docs explicitly warn about several

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (30 days - git worktree API is stable, agent CLIs may update)

**Notes:**
- Execa 9.x requires ESM (already using in project)
- Git --porcelain format guaranteed stable across git versions
- Claude Code and OpenCode both support cwd-based project detection
- Phase 1's PTY manager and process registry directly applicable for agent management
