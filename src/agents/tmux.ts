// src/agents/tmux.ts
// tmux session management for agent workspaces.
// Each workspace gets a dedicated tmux session.

import { execSync, spawnSync } from 'node:child_process';
import { platform } from 'node:os';

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
 * Prefixed with "atelier-" to avoid conflicts.
 */
export function sessionName(workspaceId: string): string {
  return `atelier-${workspaceId}`;
}

/**
 * Configure tmux session with mouse mode and clipboard integration.
 * Sets up:
 * - Mouse mode for scrolling and selection within panes
 * - OSC 52 clipboard integration (works with modern terminals)
 * - Copy-on-select behavior
 * - Paste keybindings (Ctrl+V)
 *
 * @param name - The tmux session name to configure
 */
function configureSessionOptions(name: string): void {
  const isMac = platform() === 'darwin';

  // Enable mouse mode for scrolling and selection
  execSync(
    `tmux set-option -t "${name}" mouse on`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  // Enable OSC 52 clipboard integration
  // This allows tmux to read/write system clipboard via terminal escape sequences
  // Works with modern terminals: iTerm2, kitty, Alacritty, Windows Terminal, etc.
  execSync(
    `tmux set-option -t "${name}" set-clipboard on`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  // Determine the clipboard command based on OS
  const copyCmd = isMac ? 'pbcopy' : 'xclip -selection clipboard';
  const pasteCmd = isMac ? 'pbpaste' : 'xclip -selection clipboard -o';

  // Check if clipboard command is available (for Linux)
  let hasClipboardCmd = isMac;
  if (!isMac) {
    try {
      execSync('which xclip', { encoding: 'utf-8', stdio: 'pipe' });
      hasClipboardCmd = true;
    } catch {
      // xclip not available, will rely on OSC 52 only
    }
  }

  if (hasClipboardCmd) {
    // Set the copy command for tmux's built-in copy functionality
    execSync(
      `tmux set-option -t "${name}" copy-command "${copyCmd}"`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    // Configure copy mode: when mouse drag ends, copy to clipboard automatically
    // This binds to both emacs (copy-mode) and vi (copy-mode-vi) styles
    execSync(
      `tmux bind-key -T copy-mode MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "${copyCmd}"`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    execSync(
      `tmux bind-key -T copy-mode-vi MouseDragEnd1Pane send-keys -X copy-pipe-and-cancel "${copyCmd}"`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );

    // Bind Ctrl+V to paste from system clipboard
    // Note: Cmd+V on macOS is handled by the terminal emulator directly
    execSync(
      `tmux bind-key -n C-v run-shell "${pasteCmd} | tmux load-buffer - && tmux paste-buffer"`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
  }
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

  // Configure mouse mode and clipboard integration
  configureSessionOptions(name);

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
 * Returns the visible terminal output with ANSI color codes preserved.
 *
 * @param workspaceId - Workspace identifier
 * @param lines - Number of lines to capture (default: 50)
 * @returns Captured output string with ANSI colors
 */
export function capturePane(workspaceId: string, lines: number = 50): string {
  const name = sessionName(workspaceId);

  if (!hasSession(workspaceId)) {
    return '';
  }

  try {
    // -p: print to stdout, -e: include escape sequences (colors), -S: start line
    const output = execSync(
      `tmux capture-pane -t "${name}" -p -e -S -${lines}`,
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    return output;
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

  // Save current stdin state
  const wasRaw = process.stdin.isRaw;
  const wasPaused = process.stdin.isPaused();

  // Clear screen before attaching
  process.stdout.write('\x1b[2J\x1b[H');

  // Disable raw mode before tmux takes over (tmux will set its own modes)
  if (process.stdin.isTTY && wasRaw) {
    process.stdin.setRawMode(false);
  }

  // Use spawnSync to completely block Node while tmux has control
  // This prevents Ink from interfering with the terminal
  spawnSync('tmux', ['attach', '-t', name], {
    stdio: 'inherit',
  });

  // Restore stdin state for Ink after detaching
  if (process.stdin.isTTY) {
    // Resume stdin first if it was flowing
    if (!wasPaused) {
      process.stdin.resume();
    }

    // Then restore raw mode
    if (wasRaw) {
      process.stdin.setRawMode(true);
    }

    // Drain any pending input to prevent stale keystrokes
    process.stdin.read();
  }

  // Give terminal a moment to settle after tmux releases it
  try {
    execSync('sleep 0.1', { stdio: 'ignore' });
  } catch {}

  // Aggressive terminal reset to ensure clean state for Ink
  process.stdout.write('\x1bc');        // Full terminal reset (ESC c)
  process.stdout.write('\x1b[!p');      // Soft terminal reset
  process.stdout.write('\x1b[?25h');    // Show cursor
  process.stdout.write('\x1b[?1049l');  // Exit alternate screen (if tmux left us in it)
  process.stdout.write('\x1b[2J\x1b[H'); // Clear screen and home cursor
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

// ============================================================================
// Terminal Session Management (separate from agent sessions)
// ============================================================================

/**
 * Generate a terminal tmux session name from workspace ID.
 * Terminal sessions are separate from agent sessions.
 */
export function terminalSessionName(workspaceId: string): string {
  return `atelier-terminal-${workspaceId}`;
}

/**
 * Check if a terminal tmux session exists.
 */
export function hasTerminalSession(workspaceId: string): boolean {
  try {
    execSync(`tmux has-session -t "${terminalSessionName(workspaceId)}" 2>/dev/null`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a new terminal tmux session for a workspace.
 * This starts a plain shell (no agent command).
 *
 * @param workspaceId - Workspace identifier
 * @param cwd - Working directory for the session
 */
export function createTerminalSession(
  workspaceId: string,
  cwd: string
): void {
  const name = terminalSessionName(workspaceId);

  // Kill existing session if any
  if (hasTerminalSession(workspaceId)) {
    killTerminalSession(workspaceId);
  }

  // Create detached session with a shell
  execSync(
    `tmux new-session -d -s "${name}" -c "${cwd}"`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  // Configure mouse mode and clipboard integration
  configureSessionOptions(name);
}

/**
 * Attach to a terminal tmux session.
 * This takes over the terminal until the user detaches (Ctrl+B D).
 *
 * @param workspaceId - Workspace identifier
 */
export function attachTerminalSession(workspaceId: string): void {
  const name = terminalSessionName(workspaceId);

  if (!hasTerminalSession(workspaceId)) {
    throw new Error(`No terminal tmux session for workspace: ${workspaceId}`);
  }

  // Save current stdin state
  const wasRaw = process.stdin.isRaw;
  const wasPaused = process.stdin.isPaused();

  // Clear screen before attaching
  process.stdout.write('\x1b[2J\x1b[H');

  // Disable raw mode before tmux takes over (tmux will set its own modes)
  if (process.stdin.isTTY && wasRaw) {
    process.stdin.setRawMode(false);
  }

  // Use spawnSync to completely block Node while tmux has control
  spawnSync('tmux', ['attach', '-t', name], {
    stdio: 'inherit',
  });

  // Restore stdin state for Ink after detaching
  if (process.stdin.isTTY) {
    // Resume stdin first if it was flowing
    if (!wasPaused) {
      process.stdin.resume();
    }

    // Then restore raw mode
    if (wasRaw) {
      process.stdin.setRawMode(true);
    }

    // Drain any pending input to prevent stale keystrokes
    process.stdin.read();
  }

  // Give terminal a moment to settle after tmux releases it
  try {
    execSync('sleep 0.1', { stdio: 'ignore' });
  } catch {}

  // Aggressive terminal reset to ensure clean state for Ink
  process.stdout.write('\x1bc');        // Full terminal reset (ESC c)
  process.stdout.write('\x1b[!p');      // Soft terminal reset
  process.stdout.write('\x1b[?25h');    // Show cursor
  process.stdout.write('\x1b[?1049l');  // Exit alternate screen (if tmux left us in it)
  process.stdout.write('\x1b[2J\x1b[H'); // Clear screen and home cursor
}

/**
 * Kill a terminal tmux session.
 *
 * @param workspaceId - Workspace identifier
 */
export function killTerminalSession(workspaceId: string): void {
  const name = terminalSessionName(workspaceId);

  if (hasTerminalSession(workspaceId)) {
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

// ============================================================================
// Combined Session Management (agent on left, terminal on right)
// ============================================================================

/**
 * Generate a combined tmux session name from workspace ID.
 * Combined sessions show agent and terminal side-by-side.
 */
export function combinedSessionName(workspaceId: string): string {
  return `atelier-combined-${workspaceId}`;
}

/**
 * Check if a combined tmux session exists.
 */
export function hasCombinedSession(workspaceId: string): boolean {
  try {
    execSync(`tmux has-session -t "${combinedSessionName(workspaceId)}" 2>/dev/null`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a new combined tmux session for a workspace.
 * Creates a session with two vertical panes: agent on left (70%), terminal on right (30%).
 *
 * @param workspaceId - Workspace identifier
 * @param cwd - Working directory for the session
 * @param agentCommand - Command to run in the left pane (e.g., "claude", "opencode")
 */
export function createCombinedSession(
  workspaceId: string,
  cwd: string,
  agentCommand: string
): void {
  const name = combinedSessionName(workspaceId);

  // Kill existing session if any
  if (hasCombinedSession(workspaceId)) {
    killCombinedSession(workspaceId);
  }

  // Create detached session with a shell (this will be the left pane - agent)
  execSync(
    `tmux new-session -d -s "${name}" -c "${cwd}"`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  // Configure mouse mode and clipboard integration
  configureSessionOptions(name);

  // Split window vertically (creates right pane - terminal)
  // -h: horizontal split (creates left/right panes)
  // -t: target session
  // -c: start directory for new pane
  // -p 30: right pane gets 30% of the width, left pane keeps 70%
  execSync(
    `tmux split-window -h -t "${name}" -c "${cwd}" -p 30`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  // Select the left pane (pane 0) and send the agent command
  execSync(
    `tmux select-pane -t "${name}:0.0"`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  execSync(
    `tmux send-keys -t "${name}:0.0" "${agentCommand}" Enter`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );

  // Keep focus on the left pane (agent)
  execSync(
    `tmux select-pane -t "${name}:0.0"`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );
}

/**
 * Attach to a combined tmux session.
 * This takes over the terminal until the user detaches (Ctrl+B D).
 *
 * @param workspaceId - Workspace identifier
 */
export function attachCombinedSession(workspaceId: string): void {
  const name = combinedSessionName(workspaceId);

  if (!hasCombinedSession(workspaceId)) {
    throw new Error(`No combined tmux session for workspace: ${workspaceId}`);
  }

  // Save current stdin state
  const wasRaw = process.stdin.isRaw;
  const wasPaused = process.stdin.isPaused();

  // Clear screen before attaching
  process.stdout.write('\x1b[2J\x1b[H');

  // Disable raw mode before tmux takes over (tmux will set its own modes)
  if (process.stdin.isTTY && wasRaw) {
    process.stdin.setRawMode(false);
  }

  // Use spawnSync to completely block Node while tmux has control
  spawnSync('tmux', ['attach', '-t', name], {
    stdio: 'inherit',
  });

  // Restore stdin state for Ink after detaching
  if (process.stdin.isTTY) {
    // Resume stdin first if it was flowing
    if (!wasPaused) {
      process.stdin.resume();
    }

    // Then restore raw mode
    if (wasRaw) {
      process.stdin.setRawMode(true);
    }

    // Drain any pending input to prevent stale keystrokes
    process.stdin.read();
  }

  // Give terminal a moment to settle after tmux releases it
  try {
    execSync('sleep 0.1', { stdio: 'ignore' });
  } catch {}

  // Aggressive terminal reset to ensure clean state for Ink
  process.stdout.write('\x1bc');        // Full terminal reset (ESC c)
  process.stdout.write('\x1b[!p');      // Soft terminal reset
  process.stdout.write('\x1b[?25h');    // Show cursor
  process.stdout.write('\x1b[?1049l');  // Exit alternate screen (if tmux left us in it)
  process.stdout.write('\x1b[2J\x1b[H'); // Clear screen and home cursor
}

/**
 * Kill a combined tmux session.
 *
 * @param workspaceId - Workspace identifier
 */
export function killCombinedSession(workspaceId: string): void {
  const name = combinedSessionName(workspaceId);

  if (hasCombinedSession(workspaceId)) {
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
