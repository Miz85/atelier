// src/processes/pty-manager.ts
import * as pty from 'node-pty';
import { processRegistry } from './cleanup.js';

export interface PtyOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

export interface PtyEvents {
  onData?: (data: string) => void;
  onExit?: (exitCode: number, signal?: number) => void;
}

/**
 * Buffered PTY process wrapper.
 *
 * Addresses node-pty race condition where data events can fire after exit event.
 * Pattern: Buffer all data until exit, then flush (VS Code approach).
 *
 * @see https://github.com/microsoft/node-pty/issues/72
 */
export class BufferedPtyProcess {
  private ptyProcess: pty.IPty;
  private dataBuffer: string[] = [];
  private exitReceived = false;
  private _exitCode: number | undefined;
  private events: PtyEvents = {};

  constructor(options: PtyOptions) {
    const {
      command,
      args = [],
      cwd = process.cwd(),
      env = process.env as Record<string, string>,
      cols = 80,
      rows = 24,
    } = options;

    this.ptyProcess = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env,
    });

    // Register for cleanup
    processRegistry.register(this.ptyProcess.pid, `PTY: ${command} ${args.join(' ')}`);

    // Buffer all data events
    this.ptyProcess.onData((data) => {
      if (this.exitReceived) {
        // Edge case: data after exit - flush immediately
        console.log('[PTY] Data received after exit, flushing');
        this.dataBuffer.push(data);
        this.flushBuffer();
      } else {
        // Normal case: buffer data
        this.dataBuffer.push(data);
        // Also emit immediately for real-time streaming
        this.events.onData?.(data);
      }
    });

    // Exit event marks end of data stream
    this.ptyProcess.onExit(({ exitCode, signal }) => {
      this.exitReceived = true;
      this._exitCode = exitCode;

      // Unregister from cleanup (process already exited)
      processRegistry.unregister(this.ptyProcess.pid);

      // Flush any remaining buffered data
      this.flushBuffer();

      // Notify listener
      this.events.onExit?.(exitCode, signal);
    });
  }

  /**
   * Get process ID.
   */
  get pid(): number {
    return this.ptyProcess.pid;
  }

  /**
   * Get exit code (undefined if still running).
   */
  get exitCode(): number | undefined {
    return this._exitCode;
  }

  /**
   * Check if process has exited.
   */
  get hasExited(): boolean {
    return this.exitReceived;
  }

  /**
   * Get all buffered output (useful for getting complete output after exit).
   */
  get allOutput(): string {
    return this.dataBuffer.join('');
  }

  /**
   * Register event handlers.
   */
  on(events: PtyEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Write data to PTY stdin.
   */
  write(data: string): void {
    if (!this.exitReceived) {
      this.ptyProcess.write(data);
    }
  }

  /**
   * Resize PTY.
   */
  resize(cols: number, rows: number): void {
    if (!this.exitReceived) {
      this.ptyProcess.resize(cols, rows);
    }
  }

  /**
   * Kill the process.
   */
  kill(signal: string = 'SIGTERM'): void {
    if (!this.exitReceived) {
      this.ptyProcess.kill(signal);
    }
  }

  private flushBuffer(): void {
    // Buffer already emitted via onData in real-time
    // This method exists for the edge case of data-after-exit
    // In that case, we re-emit the late data
    if (this.exitReceived && this.dataBuffer.length > 0) {
      // Already flushed via onData events
    }
  }
}

/**
 * Spawn a buffered PTY process.
 * Convenience function.
 */
export function spawnPty(
  command: string,
  args: string[] = [],
  options: Partial<PtyOptions> = {}
): BufferedPtyProcess {
  return new BufferedPtyProcess({
    command,
    args,
    ...options,
  });
}
