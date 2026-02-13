import { createWorkspace, deleteWorkspace, syncWorkspacesFromGit, gitWorktreeToWorkspace } from './workspace-manager.js';
import { listWorktrees, type GitWorktree } from './git-worktree.js';
import { getWorkspaceMetadata, removeWorkspaceMetadata } from '../config/storage.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'execa';

async function test() {
  // Create temp directory for test
  const testDir = mkdtempSync(join(tmpdir(), 'atelier-wm-test-'));
  const originPath = join(testDir, 'origin');
  const repoPath = join(testDir, 'repo');

  try {
    // Initialize a test git repo with a fake origin
    console.log('Setting up test repo...');

    // Create origin (bare repo)
    await $`git init --bare ${originPath}`;

    // Clone it to create a working repo
    await $`git clone ${originPath} ${repoPath}`;
    await $({ cwd: repoPath })`git config user.email test@test.com`;
    await $({ cwd: repoPath })`git config user.name Test`;

    // Create initial commit and push to origin
    await $({ cwd: repoPath })`git commit --allow-empty -m "initial"`;
    await $({ cwd: repoPath })`git push origin master`;

    // Create main branch (many repos use main now)
    await $({ cwd: repoPath })`git branch -m main`;
    await $({ cwd: repoPath })`git push -u origin main`;

    // Test 1: createWorkspace
    console.log('\nTest 1: createWorkspace');
    const workspace = await createWorkspace({
      repoPath,
      branchName: 'feature/test-workspace',
      name: 'Test Workspace',
      agent: 'claude',
      baseBranch: 'main',
    });

    console.log('Created workspace:', workspace);
    if (!workspace.id) throw new Error('Missing workspace ID');
    if (workspace.name !== 'Test Workspace') throw new Error('Wrong name');
    if (workspace.branch !== 'feature/test-workspace') throw new Error('Wrong branch');
    if (!workspace.path.includes('feature-test-workspace')) throw new Error('Wrong path');
    console.log('✓ createWorkspace works');

    // Verify worktree exists in git
    const worktrees = await listWorktrees(repoPath);
    console.log('Worktrees:', worktrees.length);
    if (worktrees.length !== 2) throw new Error('Expected 2 worktrees (main + new)');

    // Test 2: syncWorkspacesFromGit
    console.log('\nTest 2: syncWorkspacesFromGit');

    // With empty app state, should report workspace to add
    const sync1 = await syncWorkspacesFromGit(repoPath, []);
    console.log('Sync result (empty state):', {
      toAdd: sync1.toAdd.length,
      toRemove: sync1.toRemove.length,
      unchanged: sync1.unchanged.length,
    });
    if (sync1.toAdd.length !== 1) throw new Error('Should have 1 workspace to add');

    // With workspace in state, should be unchanged
    const sync2 = await syncWorkspacesFromGit(repoPath, [workspace]);
    console.log('Sync result (with state):', {
      toAdd: sync2.toAdd.length,
      toRemove: sync2.toRemove.length,
      unchanged: sync2.unchanged.length,
    });
    if (sync2.unchanged.length !== 1) throw new Error('Should have 1 unchanged');
    console.log('✓ syncWorkspacesFromGit works');

    // Test 3: deleteWorkspace
    console.log('\nTest 3: deleteWorkspace');
    await deleteWorkspace(workspace, repoPath, {
      deleteFolder: true,
      deleteBranch: true,
    });

    const worktreesAfter = await listWorktrees(repoPath);
    if (worktreesAfter.length !== 1) throw new Error('Expected 1 worktree after delete');
    console.log('✓ deleteWorkspace works');

    // Test 4: gitWorktreeToWorkspace
    console.log('\nTest 4: gitWorktreeToWorkspace');
    const mockWorktree: GitWorktree = {
      path: '/test/path',
      head: 'abc123',
      branch: 'refs/heads/feature/test',
      bare: false,
      detached: false,
      locked: false,
      prunable: false,
    };

    const mockSettings = { defaultAgent: 'claude' as const, ideCommand: 'code' };
    const converted = gitWorktreeToWorkspace(mockWorktree, mockSettings);

    console.log('Converted workspace:', converted);
    if (converted.branch !== 'feature/test') throw new Error('Wrong branch');
    if (converted.name !== 'test') throw new Error('Wrong name');
    if (converted.agent !== 'claude') throw new Error('Wrong agent');
    if (converted.path !== '/test/path') throw new Error('Wrong path');
    if (!converted.id) throw new Error('Missing ID');
    console.log('✓ gitWorktreeToWorkspace works');

    // Test 5: Agent type persistence (opencode selection survives sync)
    console.log('\nTest 5: Agent type persistence');
    
    // Create workspace with opencode agent
    const opencodeWorkspace = await createWorkspace({
      repoPath,
      branchName: 'feature/opencode-test',
      name: 'OpenCode Workspace',
      agent: 'opencode',
      baseBranch: 'main',
    });
    
    console.log('Created opencode workspace:', opencodeWorkspace.agent);
    if (opencodeWorkspace.agent !== 'opencode') throw new Error('Agent should be opencode');
    
    // Verify metadata was persisted
    const metadata = getWorkspaceMetadata();
    if (!metadata[opencodeWorkspace.path]) throw new Error('Metadata not saved');
    if (metadata[opencodeWorkspace.path].agent !== 'opencode') throw new Error('Metadata agent should be opencode');
    console.log('✓ Metadata persisted correctly');
    
    // Simulate app restart: convert git worktree back to workspace (with default=claude)
    const worktreesForSync = await listWorktrees(repoPath);
    const opencodeWorktree = worktreesForSync.find(w => w.path === opencodeWorkspace.path);
    if (!opencodeWorktree) throw new Error('Worktree not found');
    
    const settingsWithClaudeDefault = { defaultAgent: 'claude' as const, ideCommand: 'code' };
    const restoredWorkspace = gitWorktreeToWorkspace(opencodeWorktree, settingsWithClaudeDefault);
    
    console.log('Restored workspace agent:', restoredWorkspace.agent);
    if (restoredWorkspace.agent !== 'opencode') {
      throw new Error(`Agent should be opencode (from metadata), got: ${restoredWorkspace.agent}`);
    }
    console.log('✓ Agent type preserved after sync (opencode not overwritten by default)');
    
    // Cleanup: delete workspace and verify metadata is removed
    await deleteWorkspace(opencodeWorkspace, repoPath, { deleteFolder: true, deleteBranch: true });
    const metadataAfterDelete = getWorkspaceMetadata();
    if (metadataAfterDelete[opencodeWorkspace.path]) {
      throw new Error('Metadata should be removed after workspace deletion');
    }
    console.log('✓ Metadata cleaned up on delete');

    console.log('\n✓ All workspace-manager tests passed!');
  } finally {
    // Cleanup
    rmSync(testDir, { recursive: true, force: true });
  }
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
