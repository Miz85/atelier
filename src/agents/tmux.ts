// src/agents/tmux.ts
// tmux session management for agent workspaces.
// Each workspace gets a dedicated tmux session.

import { execSync, spawnSync } from 'node:child_process';

/**
 * Check if tmux is available on the system.
 * @throws Error if tmux is not installed
 */
export function checkTmuxAvailable(): void {
  try {
    execSync('which tmux', { encoding: 'utf-8', stdio: 'pipe' });
  } catch {
    throw new Error(
      'tmux is not installed. Please install it:\n' +
      '  macOS: brew install tmux\n' +
      '  Ubuntu/Debian: sudo apt install tmux\n' +
      '  Fedora: sudo dnf install tmux'
    );
  }
}

/**
 * Generate a tmux session name from workspace ID.
 * Prefixed with "equipe-" to avoid conflicts.
 */
export function sessionName(workspaceId: string): string {
  return `equipe-${workspaceId}`;
}

/**
 * Check if a tmux session exists.
 */
export function hasSession(workspaceId: string): boolean {
  try {
    execSync(`tmux has-session -t "${sessionName(workspaceId)}" 2>/dev/null`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a new tmux session for a workspace.
 * The session starts in the workspace directory with a shell,
 * then the agent command is sent to the shell.
 *
 * @param workspaceId - Workspace identifier
 * @param cwd - Working directory for the session
 * @param command - Command to run in the session (e.g., "claude", "opencode")
 */
export function createSession(
  workspaceId: string,
  cwd: string,
  command: string
): void {
  const name = sessionName(workspaceId);

  // Kill existing session if any (shouldn't happen, but be safe)
  if (hasSession(workspaceId)) {
    killSession(workspaceId);
  }

  // Create detached session with a shell (session persists even if command exits)
  // -d: detached, -s: session name, -c: start directory
  execSync(
    `tmux new-session -d -s "${name}" -c "${cwd}"`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  // Send the agent command to the shell
  // Small delay to ensure shell is ready
  execSync(
    `tmux send-keys -t "${name}" "${command}" Enter`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );
}

/**
 * Kill a tmux session.
 *
 * @param workspaceId - Workspace identifier
 */
export function killSession(workspaceId: string): void {
  const name = sessionName(workspaceId);

  if (hasSession(workspaceId)) {
    try {
      execSync(`tmux kill-session -t "${name}"`, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });
    } catch {
      // Session may have already exited
    }
  }
}

/**
 * Send keys to a tmux session.
 * Use this for programmatic input (not interactive).
 *
 * @param workspaceId - Workspace identifier
 * @param keys - Keys to send (use "Enter" for newline)
 */
export function sendKeys(workspaceId: string, keys: string): void {
  const name = sessionName(workspaceId);

  if (!hasSession(workspaceId)) {
    throw new Error(`No tmux session for workspace: ${workspaceId}`);
  }

  // Escape special characters for tmux
  const escaped = keys.replace(/"/g, '\\"');
  execSync(`tmux send-keys -t "${name}" "${escaped}"`, {
    encoding: 'utf-8',
    stdio: 'pipe',
  });
}

/**
 * Strip ANSI escape codes from a string.
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
            .replace(/\x1b\][^\x07]*\x07/g, '')  // OSC sequences
            .replace(/[\x00-\x09\x0b-\x1f]/g, ''); // Other control chars except newline
}

/**
 * Capture the current pane content from a tmux session.
 * Returns the visible terminal output with ANSI codes stripped.
 *
 * @param workspaceId - Workspace identifier
 * @param lines - Number of lines to capture (default: 50)
 * @returns Captured output string (ANSI codes stripped)
 */
export function capturePane(workspaceId: string, lines: number = 50): string {
  const name = sessionName(workspaceId);

  if (!hasSession(workspaceId)) {
    return '';
  }

  try {
    // -p: print to stdout, -S: start line (negative = from end)
    const output = execSync(
      `tmux capture-pane -t "${name}" -p -S -${lines}`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    return stripAnsi(output);
  } catch {
    return '';
  }
}

/**
 * Attach to a tmux session.
 * This takes over the terminal until the user detaches (Ctrl+B D).
 *
 * Uses spawnSync to completely block Node.js while tmux has control,
 * preventing any interference from Ink or other async processes.
 *
 * @param workspaceId - Workspace identifier
 */
export function attachSession(workspaceId: string): void {
  const name = sessionName(workspaceId);

  if (!hasSession(workspaceId)) {
    throw new Error(`No tmux session for workspace: ${workspaceId}`);
  }

  // Clear screen before attaching
  process.stdout.write('\x1b[2J\x1b[H');

  // Use spawnSync to completely block Node while tmux has control
  // This prevents Ink from interfering with the terminal
  spawnSync('tmux', ['attach', '-t', name], {
    stdio: 'inherit',
  });

  // Clear screen after detaching to let Ink redraw cleanly
  process.stdout.write('\x1b[2J\x1b[H');
}

/**
 * Get the status of a tmux session.
 *
 * @param workspaceId - Workspace identifier
 * @returns 'running' if session exists, 'stopped' otherwise
 */
export function getSessionStatus(workspaceId: string): 'running' | 'stopped' {
  return hasSession(workspaceId) ? 'running' : 'stopped';
}

/**
 * Resize a tmux session to match terminal dimensions.
 * Called before attaching to ensure proper display.
 *
 * @param workspaceId - Workspace identifier
 */
export function resizeSession(workspaceId: string): void {
  const name = sessionName(workspaceId);

  if (!hasSession(workspaceId)) return;

  const cols = process.stdout.columns || 80;
  const rows = process.stdout.rows || 24;

  try {
    // Force the session to resize to current terminal size
    execSync(
      `tmux resize-window -t "${name}" -x ${cols} -y ${rows}`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
  } catch {
    // Resize may fail if session is in certain states, ignore
  }
}
