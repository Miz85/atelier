// src/workspace/test-git-worktree.ts
import { listWorktrees, addWorktree, removeWorktree } from './git-worktree.js';
import { mkdtempSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { $ } from 'execa';

async function test() {
  // Create temp directory for test repo
  const testDir = mkdtempSync(join(tmpdir(), 'atelier-test-'));
  const repoPath = join(testDir, 'repo');

  try {
    console.log('Setting up test repository...');
    // Initialize a test git repo
    await $`git init ${repoPath}`;
    await $({ cwd: repoPath })`git config user.email test@test.com`;
    await $({ cwd: repoPath })`git config user.name Test`;
    await $({ cwd: repoPath })`git commit --allow-empty -m initial`;

    // Test listWorktrees (should show main worktree)
    console.log('\nTest 1: listWorktrees()...');
    const worktrees = await listWorktrees(repoPath);
    console.log('Found worktrees:', worktrees.length);
    console.log('Main worktree:', worktrees[0]);

    if (worktrees.length !== 1) {
      throw new Error(`Expected 1 worktree, got ${worktrees.length}`);
    }
    if (!worktrees[0].path.includes('repo')) {
      throw new Error(`Wrong path: ${worktrees[0].path}`);
    }
    if (!worktrees[0].head) {
      throw new Error('Missing HEAD');
    }
    console.log('✓ listWorktrees works');

    // Test addWorktree (manually using git command since we don't have origin)
    console.log('\nTest 2: addWorktree() simulation...');
    const worktreePath = join(testDir, 'worktree-feature');

    // Simulate what addWorktree does, but with HEAD instead of origin/main
    await $({ cwd: repoPath })`git worktree add -b feature ${worktreePath} HEAD`;

    const worktrees2 = await listWorktrees(repoPath);
    console.log('Found worktrees after add:', worktrees2.length);

    if (worktrees2.length !== 2) {
      throw new Error(`Expected 2 worktrees after add, got ${worktrees2.length}`);
    }

    // Resolve path to handle macOS /var -> /private/var symlink
    const resolvedWorktreePath = realpathSync(worktreePath);
    const featureWorktree = worktrees2.find(w => w.path === resolvedWorktreePath);
    if (!featureWorktree) {
      console.log('Expected path:', resolvedWorktreePath);
      console.log('Available paths:', worktrees2.map(w => w.path));
      throw new Error(`Feature worktree not found at ${resolvedWorktreePath}`);
    }
    if (!featureWorktree.branch?.includes('feature')) {
      throw new Error(`Wrong branch: ${featureWorktree.branch}`);
    }
    console.log('Feature worktree:', featureWorktree);
    console.log('✓ addWorktree simulation works');

    // Test removeWorktree
    console.log('\nTest 3: removeWorktree()...');
    // Use the resolved path for removal
    await removeWorktree(repoPath, resolvedWorktreePath);

    const worktrees3 = await listWorktrees(repoPath);
    console.log('Found worktrees after remove:', worktrees3.length);

    if (worktrees3.length !== 1) {
      throw new Error(`Expected 1 worktree after remove, got ${worktrees3.length}`);
    }
    console.log('✓ removeWorktree works');

    console.log('\n✓ All tests passed!');
  } catch (error: any) {
    console.error('\n✗ Test failed:', error.message);
    if (error.stderr) {
      console.error('stderr:', error.stderr);
    }
    process.exit(1);
  } finally {
    // Cleanup
    console.log('\nCleaning up...');
    rmSync(testDir, { recursive: true, force: true });
    console.log('Done.');
  }
}

test().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
