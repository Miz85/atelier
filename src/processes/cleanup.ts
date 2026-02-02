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
    console.log(`[ProcessRegistry] Registered PID ${pid} (${description})`);
  }

  /**
   * Unregister a process (e.g., when it exits normally).
   */
  unregister(pid: number): void {
    const desc = this.processes.get(pid);
    if (this.processes.delete(pid)) {
      console.log(`[ProcessRegistry] Unregistered PID ${pid} (${desc})`);
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
      console.log('[ProcessRegistry] Cleanup already in progress, skipping');
      return;
    }
    this.cleanupInProgress = true;

    if (this.processes.size === 0) {
      console.log('[ProcessRegistry] No processes to clean up');
      return;
    }

    console.log(`[ProcessRegistry] Cleaning up ${this.processes.size} process(es)...`);

    // Kill all registered processes and their children
    for (const [pid, description] of this.processes) {
      console.log(`[ProcessRegistry] Terminating PID ${pid} (${description})...`);

      try {
        // Use terminate package to kill entire process tree
        terminate(pid, 'SIGTERM', (err) => {
          if (err) {
            console.error(`[ProcessRegistry] SIGTERM failed for ${pid}:`, err.message);
            // Fallback to SIGKILL if SIGTERM fails
            try {
              process.kill(pid, 'SIGKILL');
              console.log(`[ProcessRegistry] SIGKILL sent to ${pid}`);
            } catch (killErr) {
              // Process may already be dead, ignore
              console.log(`[ProcessRegistry] Process ${pid} already dead`);
            }
          } else {
            console.log(`[ProcessRegistry] Terminated PID ${pid}`);
          }
        });
      } catch (err) {
        console.error(`[ProcessRegistry] Error terminating ${pid}:`, err);
      }
    }

    this.processes.clear();
    console.log('[ProcessRegistry] Cleanup complete');
  }
}

// Global singleton - must be imported to track all processes
export const processRegistry = new ProcessRegistry();
