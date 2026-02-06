#!/usr/bin/env node
// CommonJS wrapper to load ESM module in pkg
(async () => {
  try {
    await import('./dist/index.js');
  } catch (error) {
    console.error('Failed to start equipe:', error);
    process.exit(1);
  }
})();
