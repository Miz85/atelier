// src/processes/lifecycle.ts
import { processRegistry } from './cleanup.js';

/**
 * Setup graceful shutdown handlers for all termination signals.
 * MUST be called early in app lifecycle, before spawning any processes.
 *
 * Handles:
 * - SIGINT (Ctrl+C)
 * - SIGTERM (Docker/systemd stop)
 * - SIGHUP (terminal closed)
 * - SIGQUIT (Ctrl+\)
 * - uncaughtException
 * - unhandledRejection
 */
export function setupGracefulShutdown(
  additionalCleanup?: () => void | Promise<void>
): void {
  let shutdownInProgress = false;

  const shutdown = async (reason: string, exitCode: number = 0) => {
    if (shutdownInProgress) {
      return;
    }
    shutdownInProgress = true;

    // Set timeout to force exit if cleanup hangs
    const forceExitTimeout = setTimeout(() => {
      console.error('[Lifecycle] Cleanup timeout (5s), forcing exit');
      process.exit(1);
    }, 5000);

    try {
      // Run additional cleanup first (e.g., save state, close connections)
      if (additionalCleanup) {
        await additionalCleanup();
      }

      // Kill all tracked processes
      processRegistry.cleanup();

      // Restore terminal state (in case raw mode was enabled)
      if (process.stdin.isTTY) {
        try {
          process.stdin.setRawMode(false);
        } catch {
          // May fail if stdin not in raw mode, ignore
        }
      }

      clearTimeout(forceExitTimeout);
      process.exit(exitCode);
    } catch (error) {
      clearTimeout(forceExitTimeout);
      console.error('[Lifecycle] Cleanup error:', error);
      process.exit(1);
    }
  };

  // Signal handlers
  const signalHandler = (signal: NodeJS.Signals) => {
    // Standard exit codes: 128 + signal number
    const signalCodes: Record<string, number> = {
      'SIGINT': 130,   // 128 + 2
      'SIGTERM': 143,  // 128 + 15
      'SIGHUP': 129,   // 128 + 1
      'SIGQUIT': 131,  // 128 + 3
    };
    shutdown(signal, signalCodes[signal] ?? 1);
  };

  process.on('SIGINT', () => signalHandler('SIGINT'));
  process.on('SIGTERM', () => signalHandler('SIGTERM'));
  process.on('SIGHUP', () => signalHandler('SIGHUP'));
  process.on('SIGQUIT', () => signalHandler('SIGQUIT'));

  // Error handlers
  process.on('uncaughtException', (error) => {
    console.error('[Lifecycle] Uncaught exception:', error);
    shutdown('uncaughtException', 1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[Lifecycle] Unhandled rejection:', reason);
    shutdown('unhandledRejection', 1);
  });

  // Note: process.on('exit') only allows sync code
  // Heavy cleanup done in signal handlers above
  process.on('exit', (code) => {
    // Exit silently
  });
}
