// src/state/test-state.ts
// Temporary test script - verifies Jotai + filesystem storage

import { createStore } from 'jotai';
import { workspacesAtom, Workspace } from './workspace.js';
import { settingsAtom, Settings } from './settings.js';
import { fsStorage } from '../config/storage.js';
import * as crypto from 'node:crypto';

console.log('=== State Persistence Test ===\n');

// Create Jotai store (simulates what Ink Provider would do)
const store = createStore();

// Test 1: Read initial state (should be empty or previous)
console.log('--- Initial State ---');
const initialWorkspaces = store.get(workspacesAtom);
const initialSettings = store.get(settingsAtom);
console.log('Workspaces:', JSON.stringify(initialWorkspaces, null, 2));
console.log('Settings:', JSON.stringify(initialSettings, null, 2));

// Test 2: Add a workspace
console.log('\n--- Adding Workspace ---');
const testWorkspace: Workspace = {
  id: crypto.randomUUID(),
  name: 'test-workspace',
  path: '/tmp/test-worktree',
  branch: 'feature/test',
  agent: 'claude',
  createdAt: new Date().toISOString(),
  lastActiveAt: new Date().toISOString(),
};

store.set(workspacesAtom, [...initialWorkspaces, testWorkspace]);
console.log('Added workspace:', testWorkspace.name);

// Test 3: Modify settings
console.log('\n--- Updating Settings ---');
store.set(settingsAtom, { ideCommand: 'cursor', defaultAgent: 'opencode' });
console.log('Settings updated');

// Test 4: Verify persistence by reading files directly
console.log('\n--- Verifying Disk Persistence ---');
const diskWorkspaces = fsStorage.getItem<Workspace[]>('workspaces', []);
const diskSettings = fsStorage.getItem<Settings>('settings', { ideCommand: '', defaultAgent: 'claude' });
console.log('Workspaces on disk:', diskWorkspaces.length, 'items');
console.log('Settings on disk:', JSON.stringify(diskSettings, null, 2));

// Test 5: Clean up test data
console.log('\n--- Cleanup ---');
store.set(workspacesAtom, initialWorkspaces); // Restore original
store.set(settingsAtom, initialSettings);
console.log('Restored original state');

console.log('\n=== Test Complete ===');
console.log('Restart this script to verify persistence survives process restart.');
