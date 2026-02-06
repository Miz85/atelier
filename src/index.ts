#!/usr/bin/env node
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
  console.error('[atelier] Error:', error instanceof Error ? error.message : error);
  process.exit(1);
}

// CRITICAL: Setup shutdown handlers BEFORE any rendering
setupGracefulShutdown(async () => {});

// Clear console before rendering
console.clear();

// Render Ink app (no alternate screen for now - debugging)
const app = render(React.createElement(App));

// Wait for exit
app.waitUntilExit().catch((error) => {
  console.error('[atelier] Exit error:', error);
  process.exit(1);
});
