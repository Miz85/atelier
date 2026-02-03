// src/index.ts
import React from 'react';
import { render } from 'ink';
import { App } from './app.js';
import { setupGracefulShutdown } from './processes/lifecycle.js';
import { checkTmuxAvailable } from './agents/tmux.js';

// Check tmux availability before starting
try {
  checkTmuxAvailable();
} catch (error) {
  console.error('[equipe] Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}

// CRITICAL: Setup shutdown handlers BEFORE any rendering
// This ensures cleanup runs even if app crashes during startup
setupGracefulShutdown(async () => {
  console.log('[equipe] Saving state before exit...');
  // Additional cleanup can go here (e.g., force-save state)
});

console.log('[equipe] Starting...');

// Render Ink app
const app = render(React.createElement(App));

// Wait for exit
app.waitUntilExit().then(() => {
  console.log('[equipe] Exited cleanly');
}).catch((error) => {
  console.error('[equipe] Exit error:', error);
  process.exit(1);
});
