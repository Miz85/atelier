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
  // Exit alternate screen buffer on crash/signal
  process.stdout.write('\x1b[?1049l');
});

// Enter alternate screen buffer (fullscreen mode)
process.stdout.write('\x1b[?1049h');
process.stdout.write('\x1b[H'); // Move cursor to top-left

// Render Ink app
const app = render(React.createElement(App));

// Wait for exit and restore terminal
app.waitUntilExit().then(() => {
  // Exit alternate screen buffer (restore previous terminal content)
  process.stdout.write('\x1b[?1049l');
}).catch((error) => {
  process.stdout.write('\x1b[?1049l');
  console.error('[equipe] Exit error:', error);
  process.exit(1);
});
