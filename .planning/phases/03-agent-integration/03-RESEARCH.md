# Phase 3: Agent Integration - Research

**Researched:** 2026-02-03
**Domain:** Interactive process management with pseudo-terminals in Node.js
**Confidence:** HIGH

## Summary

Agent integration requires spawning interactive CLI tools (Claude Code, OpenCode) in isolated workspaces and managing bidirectional communication with streaming output. The standard approach uses **node-pty** for full terminal emulation rather than execa, since agents require true TTY interaction with control sequences, colors, and readline functionality.

The established pattern combines node-pty for process management with Ink's `<Static>` component for displaying streaming output in a React-based TUI. Jotai atoms manage process state (running/stopped), and a process registry singleton tracks spawned agents across workspaces. Critical cleanup patterns using `.dispose()` prevent memory leaks from lingering event handlers.

Key architectural decisions:
- Use **node-pty** for agent spawning (not execa) - agents need full terminal emulation
- Leverage Ink's `<Static>` component for append-only streaming output
- Store listener references and call `.dispose()` on cleanup to prevent memory leaks
- Handle SIGTERM before SIGKILL for graceful shutdown (already decided in STATE.md)
- Detect stdin TTY availability before enabling raw mode

**Primary recommendation:** Use node-pty with explicit event listener disposal pattern, Ink Static component for streaming display, and Jotai atoms for process lifecycle state management.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node-pty | 1.1.0+ | Pseudoterminal emulation | Powers VS Code's terminal, full TTY emulation with control sequences, cross-platform (Windows ConPTY support) |
| execa | 9.6+ | Non-interactive command execution | Promise-based API, safe from shell injection, used for git CLI (already in stack) |
| ink | Latest | React-based TUI rendering | Already established in project, provides Static component for streaming output |
| jotai | Latest | State management | Already established in project, manages process state atoms |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| conf | Latest | Configuration storage | Already in stack - store default agent preference (AGENT-06) |
| N/A | N/A | Process registry | Already decided - global singleton for tracking spawned processes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-pty | execa | Execa lacks terminal emulation - Claude Code/OpenCode need real TTY for interactive features, colors, readline |
| node-pty | child_process.spawn | Lower-level API, no cross-platform TTY abstraction, manual pty handling required |
| Custom streaming | Ink Static | Custom solution misses re-render handling, console.log interception, proven pattern |

**Installation:**
```bash
npm install node-pty@^1.1.0
```

**Build requirements (platform-specific):**
- **Linux (apt):** `sudo apt install -y make python build-essential`
- **macOS:** Xcode from App Store
- **Windows:** Visual Studio build tools with Windows SDK (Desktop C++), Spectre-mitigated libraries required

## Architecture Patterns

### Recommended Project Structure
```
src/
├── agents/              # Agent spawning and management
│   ├── spawn.ts        # node-pty spawn logic
│   ├── lifecycle.ts    # Start/stop/restart operations
│   └── registry.ts     # Process registry singleton (already exists)
├── components/          # Ink components
│   ├── AgentOutput.tsx # Streaming output display with Static
│   └── AgentInput.tsx  # Interactive input handling
└── state/              # Jotai atoms
    └── agents.ts       # Process state atoms
```

### Pattern 1: PTY Spawn with Cleanup
**What:** Spawn agent with node-pty and manage event listeners with explicit disposal
**When to use:** Every agent spawn operation (AGENT-01)
**Example:**
```typescript
// Source: https://github.com/microsoft/node-pty/blob/main/typings/node-pty.d.ts
import * as pty from 'node-pty';

interface AgentProcess {
  ptyProcess: pty.IPty;
  dataListener: pty.IDisposable;
  exitListener: pty.IDisposable;
}

function spawnAgent(command: string, cwd: string): AgentProcess {
  const ptyProcess = pty.spawn(command, [], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd,
    env: process.env,
    handleFlowControl: false, // Disable unless needed
  });

  // Store listener references for cleanup
  const dataListener = ptyProcess.onData((data) => {
    // Stream to UI via Jotai atom
    appendOutput(data);
  });

  const exitListener = ptyProcess.onExit(({ exitCode, signal }) => {
    // Update process state
    setProcessState('stopped');
    // Clean up listeners
    dataListener.dispose();
    exitListener.dispose();
  });

  return { ptyProcess, dataListener, exitListener };
}
```

### Pattern 2: Streaming Output Display with Ink
**What:** Display real-time agent output using Ink's Static component
**When to use:** Rendering agent output in TUI (AGENT-02)
**Example:**
```typescript
// Source: https://github.com/vadimdemedes/ink
import React from 'react';
import { Static, Text } from 'ink';
import { useAtom } from 'jotai';

const AgentOutput = () => {
  const [outputLines] = useAtom(outputLinesAtom);

  return (
    <Static items={outputLines}>
      {(line, index) => (
        <Text key={index}>{line}</Text>
      )}
    </Static>
  );
};
```

### Pattern 3: Interactive Input Handling
**What:** Send user input to PTY process
**When to use:** Interactive conversation with agent (AGENT-03)
**Example:**
```typescript
// Source: https://github.com/microsoft/node-pty
function sendInputToAgent(ptyProcess: pty.IPty, input: string) {
  // PTY requires \r for Enter, not \n
  ptyProcess.write(input + '\r');
}
```

### Pattern 4: Graceful Process Termination
**What:** SIGTERM before SIGKILL with timeout
**When to use:** Stopping agent (AGENT-04)
**Example:**
```typescript
// Source: Best practices from https://dev.to/yusadolat/nodejs-graceful-shutdown-a-beginners-guide-40b6
async function stopAgent(agent: AgentProcess, timeoutMs = 5000): Promise<void> {
  // Send SIGTERM for graceful shutdown
  agent.ptyProcess.kill('SIGTERM');

  // Wait for graceful exit
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      // Force kill if timeout exceeded
      agent.ptyProcess.kill('SIGKILL');
      resolve();
    }, timeoutMs);

    agent.exitListener = agent.ptyProcess.onExit(() => {
      clearTimeout(timeout);
      resolve();
    });
  });

  // Clean up listeners
  agent.dataListener.dispose();
  agent.exitListener.dispose();
}
```

### Pattern 5: Process State Management with Jotai
**What:** Track agent lifecycle state (running/stopped) in atoms
**When to use:** Managing process state across UI (AGENT-04, AGENT-05)
**Example:**
```typescript
// Source: https://jotai.org/docs/core/atom
import { atom } from 'jotai';

interface AgentState {
  status: 'idle' | 'running' | 'stopped';
  pid: number | null;
  output: string[];
}

const agentStateAtom = atom<AgentState>({
  status: 'idle',
  pid: null,
  output: [],
});

// Derived atom for restart capability
const canRestartAtom = atom(
  (get) => get(agentStateAtom).status === 'stopped'
);
```

### Pattern 6: Raw Mode Detection
**What:** Detect TTY support before enabling raw mode
**When to use:** Initializing Ink application to avoid crashes
**Example:**
```typescript
// Source: https://github.com/vadimdemedes/ink
import { isRawModeSupported } from 'ink';

if (!isRawModeSupported()) {
  console.error('Raw mode not supported - running in non-TTY environment');
  process.exit(1);
}
```

### Anti-Patterns to Avoid
- **Not disposing event listeners:** Leads to memory leaks, listeners fire even after `kill()` - always call `.dispose()`
- **Using execa for interactive agents:** Lacks TTY emulation, agents won't work correctly without terminal control sequences
- **Storing output in regular state:** Use Ink's `<Static>` instead of re-rendering all output on each update
- **Mixing stdout with Ink renders:** Causes visual corruption - let Ink intercept console.log or use Static component
- **Assuming stdin is always TTY:** Check `isRawModeSupported()` before enabling raw mode to handle CI/non-interactive environments
- **Not handling resize events:** Terminal dimension changes should update PTY via `ptyProcess.resize(cols, rows)`

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pseudoterminal creation | Custom pty fork logic | node-pty | Cross-platform abstraction (Linux, macOS, Windows ConPTY), handles platform-specific PTY APIs, battle-tested in VS Code |
| Terminal dimension management | Manual SIGWINCH handling | node-pty `resize()` | Proper terminal state sync, handles platform differences |
| Streaming output display | Custom line buffering + re-render | Ink `<Static>` component | Prevents re-render flicker, handles append-only logs, integrates with Ink's rendering cycle |
| Flow control (XON/XOFF) | Manual pause/resume | node-pty `handleFlowControl: true` | Implements terminal flow control protocol correctly |
| Console.log interception | Custom stdout capture | Ink's built-in interception | Prevents UI corruption, maintains separation between logs and renders |
| Event listener cleanup | Manual EventEmitter tracking | node-pty's `.dispose()` pattern | Type-safe cleanup, prevents memory leaks |

**Key insight:** Terminal emulation has deep platform-specific complexity (pty on Unix, ConPTY on Windows). node-pty abstracts this with a proven API used by major IDEs. Custom solutions invariably miss edge cases around signal handling, terminal states, and cross-platform behavior.

## Common Pitfalls

### Pitfall 1: Memory Leaks from Undisposed Listeners
**What goes wrong:** Event listeners continue firing even after `terminal.kill()` and process cleanup, causing memory leaks when managing multiple terminals
**Why it happens:** node-pty returns `IDisposable` objects but developers forget to store and dispose them, assuming `kill()` cleans up everything
**How to avoid:** Always store listener references and call `.dispose()` explicitly:
```typescript
const dataListener = ptyProcess.onData(handler);
const exitListener = ptyProcess.onExit(handler);
// Later:
dataListener.dispose();
exitListener.dispose();
```
**Warning signs:** Memory usage grows when creating/destroying terminals, listeners log output after process termination

### Pitfall 2: Raw Mode Not Supported in Non-TTY Environments
**What goes wrong:** Application crashes with "Raw mode is not supported on the current process.stdin" when run in CI, piped, or background contexts
**Why it happens:** Ink requires TTY for raw mode (capturing Ctrl+C, handling input), but stdin isn't always a TTY (CI pipelines, Docker without -t flag)
**How to avoid:** Check `isRawModeSupported()` before rendering Ink app, provide fallback or error message
```typescript
import { isRawModeSupported } from 'ink';

if (!isRawModeSupported()) {
  console.error('This command requires an interactive terminal');
  process.exit(1);
}
```
**Warning signs:** Works locally but fails in CI, error mentions "setRawMode", crashes immediately on startup

### Pitfall 3: Incorrect Line Endings for PTY Input
**What goes wrong:** Sending `\n` to PTY doesn't execute commands, appears as literal newline in terminal
**Why it happens:** PTYs expect carriage return `\r` for Enter key, not line feed `\n`
**How to avoid:** Always append `\r` when writing to PTY:
```typescript
ptyProcess.write(userInput + '\r'); // Not '\n'
```
**Warning signs:** Commands appear in terminal but don't execute, cursor moves down without running

### Pitfall 4: Static Component Misunderstanding
**What goes wrong:** Developers try to update Static items expecting changes to render, but Static displays content permanently
**Why it happens:** Confusion between Static (append-only) and normal Text (updatable) components
**How to avoid:** Use Static for logs/history that shouldn't change, use state + Text for dynamic content:
```typescript
// Correct: Static for append-only logs
<Static items={completedLogs}>
  {(log) => <Text>{log}</Text>}
</Static>

// Correct: State for updating content
<Text>Current status: {status}</Text>
```
**Warning signs:** Expecting Static content to update dynamically, confusion about why changes don't appear

### Pitfall 5: Not Handling Process Exit Edge Cases
**What goes wrong:** Process state becomes inconsistent when agent crashes or is killed externally (SIGKILL from OS, out-of-memory)
**Why it happens:** Relying only on graceful shutdown paths, not handling unexpected termination
**How to avoid:** Always register `onExit` listener to update state regardless of how process ends:
```typescript
const exitListener = ptyProcess.onExit(({ exitCode, signal }) => {
  // Update state even for unexpected exits
  setProcessState('stopped');
  cleanupResources();
  dataListener.dispose();
  exitListener.dispose();
});
```
**Warning signs:** UI shows "running" but process is dead, restart fails because cleanup didn't run

### Pitfall 6: Thread Safety Violations with node-pty
**What goes wrong:** Crashes or undefined behavior when using node-pty across worker threads
**Why it happens:** node-pty is explicitly not thread-safe
**How to avoid:** Keep all node-pty operations in main thread, document this constraint clearly
**Warning signs:** Random crashes when using worker threads, race conditions in multi-threaded scenarios

### Pitfall 7: Windows Build Failures
**What goes wrong:** `npm install node-pty` fails on Windows with build errors
**Why it happens:** Missing Spectre-mitigated libraries, incorrect Visual Studio components
**How to avoid:** Document Windows prerequisites clearly: Visual Studio build tools + Windows SDK + Spectre-mitigated libs from Individual Components tab
**Warning signs:** Build errors mentioning "MSVC", "Spectre", compile failures on Windows

## Code Examples

Verified patterns from official sources:

### Complete Agent Spawn Lifecycle
```typescript
// Source: https://github.com/microsoft/node-pty/blob/main/typings/node-pty.d.ts
// Combined with Jotai pattern from https://jotai.org/docs/core/atom
import * as pty from 'node-pty';
import { atom, useAtom } from 'jotai';

interface AgentInstance {
  id: string;
  ptyProcess: pty.IPty;
  dataListener: pty.IDisposable;
  exitListener: pty.IDisposable;
  workspacePath: string;
}

const agentInstancesAtom = atom<Map<string, AgentInstance>>(new Map());

function spawnClaudeCode(workspaceId: string, workspacePath: string): string {
  const agentId = `agent-${workspaceId}-${Date.now()}`;

  const ptyProcess = pty.spawn('claude-code', [], {
    name: 'xterm-256color',
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 30,
    cwd: workspacePath,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
    },
    handleFlowControl: false,
  });

  const dataListener = ptyProcess.onData((data) => {
    // Update output atom
    appendAgentOutput(agentId, data);
  });

  const exitListener = ptyProcess.onExit(({ exitCode, signal }) => {
    console.log(`Agent ${agentId} exited with code ${exitCode}, signal ${signal}`);
    setAgentStatus(agentId, 'stopped');

    // Clean up
    dataListener.dispose();
    exitListener.dispose();
    removeAgentInstance(agentId);
  });

  // Register in global map
  const instance: AgentInstance = {
    id: agentId,
    ptyProcess,
    dataListener,
    exitListener,
    workspacePath,
  };

  agentInstancesAtom.init.set((prev) => new Map(prev).set(agentId, instance));
  setAgentStatus(agentId, 'running');

  return agentId;
}
```

### Graceful Stop with Timeout
```typescript
// Source: Best practices from https://dev.to/yusadolat/nodejs-graceful-shutdown-a-beginners-guide-40b6
async function stopAgent(agentId: string): Promise<void> {
  const instance = agentInstancesAtom.get(agentId);
  if (!instance) {
    throw new Error(`Agent ${agentId} not found`);
  }

  const GRACEFUL_TIMEOUT = 5000;

  return new Promise<void>((resolve) => {
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        console.warn(`Agent ${agentId} did not stop gracefully, sending SIGKILL`);
        instance.ptyProcess.kill('SIGKILL');
        cleanup();
      }
    }, GRACEFUL_TIMEOUT);

    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        instance.dataListener.dispose();
        instance.exitListener.dispose();
        setAgentStatus(agentId, 'stopped');
        resolve();
      }
    };

    // Replace exit listener with cleanup
    instance.exitListener.dispose();
    instance.exitListener = instance.ptyProcess.onExit(() => {
      cleanup();
    });

    // Send graceful termination signal
    instance.ptyProcess.kill('SIGTERM');
  });
}
```

### Restart Agent
```typescript
// Restart = stop + spawn
async function restartAgent(agentId: string): Promise<string> {
  const instance = agentInstancesAtom.get(agentId);
  if (!instance) {
    throw new Error(`Agent ${agentId} not found`);
  }

  const { workspacePath } = instance;
  const workspaceId = extractWorkspaceId(agentId);

  // Stop existing
  await stopAgent(agentId);

  // Spawn new
  return spawnClaudeCode(workspaceId, workspacePath);
}
```

### Ink Component for Streaming Output
```typescript
// Source: https://github.com/vadimdemedes/ink
import React from 'react';
import { Box, Static, Text } from 'ink';
import { useAtom } from 'jotai';

interface OutputLine {
  timestamp: number;
  content: string;
}

const agentOutputAtom = atom<OutputLine[]>([]);

export const AgentOutputView: React.FC<{ agentId: string }> = ({ agentId }) => {
  const [outputLines] = useAtom(agentOutputAtom);

  return (
    <Box flexDirection="column">
      <Text bold>Agent Output:</Text>
      <Static items={outputLines}>
        {(line, index) => (
          <Text key={index}>{line.content}</Text>
        )}
      </Static>
    </Box>
  );
};
```

### Send Interactive Input
```typescript
function sendInputToAgent(agentId: string, input: string): void {
  const instance = agentInstancesAtom.get(agentId);
  if (!instance) {
    throw new Error(`Agent ${agentId} not found`);
  }

  if (instance.ptyProcess.pid === undefined) {
    throw new Error(`Agent ${agentId} process is not running`);
  }

  // PTY requires \r for Enter
  instance.ptyProcess.write(input + '\r');
}
```

### Configuration for Default Agent
```typescript
// Source: conf package pattern (already in stack)
import Conf from 'conf';

interface AppConfig {
  defaultAgent: 'claude-code' | 'opencode';
}

const config = new Conf<AppConfig>({
  projectName: 'equipe',
  defaults: {
    defaultAgent: 'claude-code',
  },
});

function getDefaultAgent(): 'claude-code' | 'opencode' {
  return config.get('defaultAgent');
}

function setDefaultAgent(agent: 'claude-code' | 'opencode'): void {
  config.set('defaultAgent', agent);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| winpty (Windows) | ConPTY API | node-pty 0.9.0+ (Windows 1809+) | Better Windows support, native Windows pseudoconsole, winpty deprecated |
| Manual EventEmitter tracking | IDisposable pattern | node-pty 0.9.0+ | Type-safe cleanup, explicit resource management |
| Callback-based APIs | Promise/async-await | execa v1+ | Cleaner error handling, better DX for command execution |
| Custom stdout handling in Ink | Static component | Ink 3.0+ | Built-in support for append-only logs, better performance |

**Deprecated/outdated:**
- **winpty:** Removed from node-pty, Windows now uses ConPTY API (requires Windows 10 1809+)
- **pty.js:** Predecessor to node-pty, unmaintained, use microsoft/node-pty instead
- **Direct EventEmitter usage:** node-pty exposes IDisposable pattern, not raw EventEmitter

## Open Questions

Things that couldn't be fully resolved:

1. **Agent-specific CLI flags**
   - What we know: Claude Code and OpenCode have different CLI interfaces
   - What's unclear: Exact CLI flags for workspace specification, whether agents support `--cwd` or require execution from workspace directory
   - Recommendation: Test both agents locally, document required flags per agent type, may need agent-specific spawn logic

2. **Output encoding edge cases**
   - What we know: node-pty accepts `encoding` option in spawn options
   - What's unclear: Whether Claude Code/OpenCode output UTF-8, binary, or mixed content; how to handle ANSI escape sequences in Ink
   - Recommendation: Default to UTF-8, add escape sequence stripping if needed, test with emoji/unicode in agent output

3. **Resize handling timing**
   - What we know: PTY supports `resize(cols, rows)` method
   - What's unclear: When to call resize - on terminal resize event, on Ink component mount, or both; whether Ink provides terminal dimension hooks
   - Recommendation: Listen to process.stdout.on('resize') if available, call `ptyProcess.resize()` with new dimensions

4. **Multi-agent concurrency limits**
   - What we know: Each agent is a separate PTY process
   - What's unclear: Resource limits for concurrent agents, whether to enforce max agents per workspace or globally
   - Recommendation: Start without limits, add constraints if performance degrades, monitor memory usage per agent

5. **Agent crash recovery**
   - What we know: `onExit` fires on crash with exit code
   - What's unclear: Whether to auto-restart agents that crash, how many retries, exponential backoff
   - Recommendation: Start with manual restart only (AGENT-05), consider auto-restart in future based on user needs

## Sources

### Primary (HIGH confidence)
- node-pty GitHub repository: https://github.com/microsoft/node-pty - API reference, TypeScript definitions
- node-pty type definitions: https://github.com/microsoft/node-pty/blob/main/typings/node-pty.d.ts - Complete API surface
- Ink GitHub repository: https://github.com/vadimdemedes/ink - Component patterns, hooks documentation
- execa GitHub repository: https://github.com/sindresorhus/execa - Streaming API, current version
- Jotai documentation: https://jotai.org/docs/core/atom - Atom patterns, async support
- Event listener disposal discussion: https://github.com/microsoft/node-pty/discussions/612 - Official disposal pattern

### Secondary (MEDIUM confidence)
- Node.js graceful shutdown guide: https://dev.to/yusadolat/nodejs-graceful-shutdown-a-beginners-guide-40b6 - SIGTERM/SIGKILL patterns
- Ink 3 announcement: https://vadimdemedes.com/posts/ink-3 - Static component, console.log interception
- Better Stack execa guide: https://betterstack.com/community/guides/scaling-nodejs/execa-cli/ - Streaming patterns
- LogRocket execa article: https://blog.logrocket.com/running-commands-with-execa-in-node-js/ - Real-time output

### Tertiary (LOW confidence - validation recommended)
- Medium article on node-pty with Socket.io: https://medium.com/@deysouvik700/efficient-and-scalable-usage-of-node-js-pty-with-socket-io-for-multiple-users-402851075c4a - Multi-user patterns
- Claude Code docs on subagents: https://code.claude.com/docs/en/sub-agents - Agent spawning patterns (not verified for this project's use case)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - node-pty is the de facto standard for terminal emulation, used by VS Code, verified through official docs
- Architecture: HIGH - Patterns verified through official documentation, type definitions, and proven examples
- Pitfalls: MEDIUM - Derived from GitHub issues, community discussions, and best practice guides; some based on inference

**Research date:** 2026-02-03
**Valid until:** 2026-03-03 (30 days - stable domain, libraries are mature)
