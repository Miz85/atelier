// src/processes/cleanup.ts
import terminate from 'terminate';

/**
 * Registry for all spawned processes.
 * Ensures cleanup kills entire process trees to prevent zombies.
 */
export class ProcessRegistry {
  private processes = new Map<number, string>(); // PID -> description
  private cleanupInProgress = false;

  /**
   * Register a process for cleanup tracking.
   * @param pid Process ID to track
   * @param description Human-readable description for logging
   */
  register(pid: number, description: string = 'unknown'): void {
    this.processes.set(pid, description);
  }

  /**
   * Unregister a process (e.g., when it exits normally).
   */
  unregister(pid: number): void {
    const desc = this.processes.get(pid);
    if (this.processes.delete(pid)) {
    }
  }

  /**
   * Check if a process is registered.
   */
  has(pid: number): boolean {
    return this.processes.has(pid);
  }

  /**
   * Get count of registered processes.
   */
  get count(): number {
    return this.processes.size;
  }

  /**
   * Kill all registered processes and their children.
   * Safe to call multiple times (idempotent).
   */
  cleanup(): void {
    if (this.cleanupInProgress) {
      return;
    }
    this.cleanupInProgress = true;

    if (this.processes.size === 0) {
      return;
    }


    // Kill all registered processes and their children
    for (const [pid, description] of this.processes) {

      try {
        // Use terminate package to kill entire process tree
        terminate(pid, 'SIGTERM', (err) => {
          if (err) {
            console.error(`[ProcessRegistry] SIGTERM failed for ${pid}:`, err.message);
            // Fallback to SIGKILL if SIGTERM fails
            try {
              process.kill(pid, 'SIGKILL');
            } catch (killErr) {
              // Process may already be dead, ignore
            }
          } else {
          }
        });
      } catch (err) {
        console.error(`[ProcessRegistry] Error terminating ${pid}:`, err);
      }
    }

    this.processes.clear();
  }
}

// Global singleton - must be imported to track all processes
export const processRegistry = new ProcessRegistry();
