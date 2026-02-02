// src/config/test-config.ts
// Temporary test script - can be removed after verification

import { config, getIdeCommand, setIdeCommand, getDefaultAgent, setDefaultAgent, getConfig } from './store.js';

console.log('=== Configuration Test ===\n');

// Show config file location
console.log('Config location:', config.path);

// Test defaults
console.log('\n--- Defaults ---');
console.log('IDE command:', getIdeCommand());
console.log('Default agent:', getDefaultAgent());

// Test setters
console.log('\n--- Setting values ---');
setIdeCommand('cursor');
setDefaultAgent('opencode');
console.log('IDE command (after set):', getIdeCommand());
console.log('Default agent (after set):', getDefaultAgent());

// Test bulk access
console.log('\n--- Full config ---');
console.log(JSON.stringify(getConfig(), null, 2));

// Reset to defaults for clean state
setIdeCommand('code');
setDefaultAgent('claude');
console.log('\n--- Reset to defaults ---');
console.log(JSON.stringify(getConfig(), null, 2));

console.log('\n=== Test Complete ===');
