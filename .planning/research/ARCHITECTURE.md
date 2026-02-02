# Architecture Research

**Domain:** TUI Coding Agent Orchestration Platform
**Researched:** 2026-02-02
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                        │
│                (React Ink Components)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Agent    │  │  Diff    │  │ Terminal │  │ Status   │    │
│  │ Panel    │  │  Panel   │  │  Panel   │  │ Bar      │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │              │             │           │
├───────┴─────────────┴──────────────┴─────────────┴──────────┤
│                     STATE LAYER                              │
│              (Jotai Atoms - Reactive State)                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐    │
│  │         Application State Manager                    │    │
│  │  • workspace-state  • agent-state  • git-state      │    │
│  │  • ui-state         • settings                       │    │
│  └──────────────────┬──────────────────────────────────┘    │
│                     │                                        │
├─────────────────────┴───────────────────────────────────────┤
│                   ORCHESTRATION LAYER                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │Workspace │  │  Agent   │  │   Git    │  │   PR     │    │
│  │ Manager  │  │ Manager  │  │ Manager  │  │ Manager  │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │              │             │           │
├───────┴─────────────┴──────────────┴─────────────┴──────────┤
│                     PROCESS LAYER                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────┐   │
│  │        Process Supervisor & PTY Manager              │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐             │   │
│  │  │ Agent 1 │  │ Agent 2 │  │ Shell   │             │   │
│  │  │ (PTY)   │  │ (PTY)   │  │ (PTY)   │             │   │
│  │  └─────────┘  └─────────┘  └─────────┘             │   │
│  └──────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                   PERSISTENCE LAYER                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │Workspace │  │ Settings │  │  Agent   │                   │
│  │  Store   │  │  Store   │  │ History  │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘

External Systems:
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│  Git Repos   │   │   GitHub     │   │  File System │
│  (worktrees) │   │    API       │   │  (watchers)  │
└──────────────┘   └──────────────┘   └──────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Agent Panel** | Display agent CLI output stream, scroll management | React Ink Box with virtualized scrolling |
| **Diff Panel** | Real-time git diff display, syntax highlighting | Git diff parser + Text components |
| **Terminal Panel** | Interactive shell for user commands | PTY wrapper with input/output streams |
| **Status Bar** | Workspace info, agent status, PR state | React Ink horizontal Box with Text |
| **Workspace Manager** | Create/switch/delete git worktrees | Wrapper around `git worktree` commands |
| **Agent Manager** | Spawn/monitor/communicate with agents | PTY process manager with lifecycle hooks |
| **Git Manager** | Diff generation, change detection, commit ops | Git CLI wrapper with file watchers |
| **PR Manager** | GitHub integration, PR creation/updates | GitHub API client (gh CLI or Octokit) |
| **Process Supervisor** | PTY lifecycle, crash recovery, cleanup | node-pty with process monitoring |
| **Workspace Store** | Persist workspace configs, layouts | JSON files in ~/.config/equipe/ |
| **Settings Store** | User preferences, agent configs | JSON/YAML config files |

## Recommended Project Structure

```
src/
├── components/            # React Ink UI components
│   ├── panels/           # Major UI panes
│   │   ├── AgentPanel.tsx
│   │   ├── DiffPanel.tsx
│   │   ├── TerminalPanel.tsx
│   │   └── StatusBar.tsx
│   ├── layouts/          # Layout compositions
│   │   ├── ThreePaneLayout.tsx
│   │   └── WorkspaceView.tsx
│   ├── widgets/          # Reusable UI elements
│   │   ├── ScrollableBox.tsx
│   │   ├── FocusablePane.tsx
│   │   └── LoadingSpinner.tsx
│   └── App.tsx           # Root component
├── state/                # Jotai atoms and derived state
│   ├── atoms/
│   │   ├── workspace.ts  # Workspace state atoms
│   │   ├── agents.ts     # Agent state atoms
│   │   ├── git.ts        # Git state atoms
│   │   └── ui.ts         # UI state (focus, layout)
│   └── selectors/        # Derived state selectors
│       └── index.ts
├── services/             # Business logic layer
│   ├── workspace/
│   │   ├── WorkspaceManager.ts
│   │   └── WorkspaceStore.ts
│   ├── agents/
│   │   ├── AgentManager.ts
│   │   ├── AgentProcess.ts
│   │   └── AgentConfig.ts
│   ├── git/
│   │   ├── GitManager.ts
│   │   ├── DiffGenerator.ts
│   │   └── FileWatcher.ts
│   ├── pr/
│   │   ├── PRManager.ts
│   │   └── GitHubClient.ts
│   └── process/
│       ├── ProcessSupervisor.ts
│       └── PTYManager.ts
├── lib/                  # Utilities and helpers
│   ├── pty/             # PTY abstractions
│   ├── config/          # Config management
│   ├── events/          # Event emitters
│   └── validation/      # Input validation
├── types/               # TypeScript type definitions
│   ├── workspace.ts
│   ├── agent.ts
│   ├── git.ts
│   └── index.ts
├── cli.tsx             # CLI entry point (oclif)
└── index.tsx           # Ink render entry
```

### Structure Rationale

- **components/**: Organized by UI concern (panels, layouts, widgets) following React Ink patterns. Components are pure and read from Jotai atoms.
- **state/**: Centralized state management using Jotai atoms for reactive updates. Atoms are granular and composable.
- **services/**: Business logic separated from UI. Each manager owns a specific domain (workspace, agents, git, PR). Managers emit events and update atoms.
- **lib/**: Cross-cutting utilities that don't belong to a specific domain. PTY abstractions hide node-pty complexity.
- **types/**: Shared TypeScript interfaces and types. Domain-specific types grouped by concern.

## Architectural Patterns

### Pattern 1: Reactive State with Jotai Atoms

**What:** Use Jotai's atomic state pattern where each piece of state is an independent atom. Components subscribe to atoms they need, and re-render only when those atoms change.

**When to use:** For all application state that needs to be shared across components or persisted. Ideal for TUI apps where multiple panels need synchronized views of the same data.

**Trade-offs:**
- **Pros:** Minimal re-renders, granular updates, simple API, excellent TypeScript support, no Provider hell
- **Cons:** Requires learning atomic state mental model (different from Redux/Zustand)

**Example:**
```typescript
// state/atoms/workspace.ts
import { atom } from 'jotai';
import { Workspace } from '@/types';

export const workspacesAtom = atom<Workspace[]>([]);
export const activeWorkspaceIdAtom = atom<string | null>(null);

// Derived atom
export const activeWorkspaceAtom = atom((get) => {
  const workspaces = get(workspacesAtom);
  const activeId = get(activeWorkspaceIdAtom);
  return workspaces.find(w => w.id === activeId);
});

// components/panels/StatusBar.tsx
import { useAtomValue } from 'jotai';
import { activeWorkspaceAtom } from '@/state/atoms/workspace';

export const StatusBar = () => {
  const workspace = useAtomValue(activeWorkspaceAtom);
  return <Text>{workspace?.name ?? 'No workspace'}</Text>;
};
```

### Pattern 2: PTY-Based Process Management

**What:** Use node-pty to spawn interactive child processes (agents, shells) in pseudo-terminals. This allows full terminal emulation including ANSI escape sequences, input/output buffering, and resize handling.

**When to use:** For any child process that expects terminal interaction (Claude Code, OpenCode, shell sessions). Essential for preserving terminal colors, cursor movements, and interactive prompts.

**Trade-offs:**
- **Pros:** Full terminal compatibility, handles ANSI codes, supports resize, works with interactive tools
- **Cons:** Native dependencies (requires compilation), platform-specific quirks, more complex than spawn()

**Example:**
```typescript
// services/process/PTYManager.ts
import * as pty from 'node-pty';
import { EventEmitter } from 'events';

export class PTYManager extends EventEmitter {
  private ptyProcesses = new Map<string, pty.IPty>();

  spawn(id: string, command: string, args: string[], cwd: string) {
    const ptyProcess = pty.spawn(command, args, {
      name: 'xterm-256color',
      cols: 80,
      rows: 30,
      cwd,
      env: process.env as { [key: string]: string },
    });

    ptyProcess.onData((data) => {
      this.emit('data', id, data);
    });

    ptyProcess.onExit(({ exitCode, signal }) => {
      this.emit('exit', id, exitCode, signal);
      this.ptyProcesses.delete(id);
    });

    this.ptyProcesses.set(id, ptyProcess);
    return ptyProcess;
  }

  write(id: string, data: string) {
    this.ptyProcesses.get(id)?.write(data);
  }

  resize(id: string, cols: number, rows: number) {
    this.ptyProcesses.get(id)?.resize(cols, rows);
  }

  kill(id: string) {
    const pty = this.ptyProcesses.get(id);
    if (pty) {
      pty.kill();
      this.ptyProcesses.delete(id);
    }
  }
}
```

### Pattern 3: Event-Driven Orchestration

**What:** Use Node.js EventEmitter pattern to decouple services. Managers emit domain events (workspace-created, agent-started, git-changed) and other services subscribe to react.

**When to use:** When multiple components need to react to the same event but shouldn't be tightly coupled. Perfect for TUI apps where git changes should update multiple panels.

**Trade-offs:**
- **Pros:** Loose coupling, extensible, multiple listeners per event, familiar Node.js pattern
- **Cons:** Event flow harder to trace, no type safety on event names (use TypeScript const enums)

**Example:**
```typescript
// services/git/GitManager.ts
import { EventEmitter } from 'events';
import { watch } from 'chokidar';

export enum GitEvent {
  CHANGED = 'git:changed',
  BRANCH_CHANGED = 'git:branch-changed',
  COMMIT_CREATED = 'git:commit-created',
}

export class GitManager extends EventEmitter {
  watchWorktree(path: string) {
    const watcher = watch(`${path}/**/*`, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
    });

    watcher.on('change', (path) => {
      this.emit(GitEvent.CHANGED, { path, worktree: path });
    });
  }
}

// services/agents/AgentManager.ts
export class AgentManager {
  constructor(private gitManager: GitManager) {
    // React to git changes
    this.gitManager.on(GitEvent.CHANGED, (event) => {
      // Notify agents about code changes
      this.notifyAgents(event);
    });
  }
}
```

### Pattern 4: Virtualized Scrolling for Large Outputs

**What:** Implement windowing where only visible lines are rendered. For a terminal with 50 visible rows, render lines [scrollOffset, scrollOffset + 50] rather than all 10,000 lines.

**When to use:** For agent output panels that may receive thousands of lines. Essential for performance in long-running agent sessions.

**Trade-offs:**
- **Pros:** Constant memory usage, smooth performance regardless of output size
- **Cons:** More complex implementation, requires scroll position tracking

**Example:**
```typescript
// components/widgets/ScrollableBox.tsx
import { Box, Text } from 'ink';
import { useAtomValue } from 'jotai';
import { agentOutputAtom } from '@/state/atoms/agents';

interface Props {
  agentId: string;
  height: number;
}

export const ScrollableBox = ({ agentId, height }: Props) => {
  const output = useAtomValue(agentOutputAtom(agentId));
  const [scrollOffset, setScrollOffset] = useState(0);

  // Only render visible slice
  const visibleLines = output.slice(scrollOffset, scrollOffset + height);

  useInput((input, key) => {
    if (key.upArrow) {
      setScrollOffset(Math.max(0, scrollOffset - 1));
    } else if (key.downArrow) {
      setScrollOffset(Math.min(output.length - height, scrollOffset + 1));
    }
  });

  return (
    <Box flexDirection="column" height={height}>
      {visibleLines.map((line, i) => (
        <Text key={scrollOffset + i}>{line}</Text>
      ))}
    </Box>
  );
};
```

### Pattern 5: Focus Management for Multi-Pane Navigation

**What:** Use Ink's useFocus hook to implement keyboard navigation between panes. Tab cycles focus, arrow keys navigate within focused pane.

**When to use:** For any multi-pane TUI where users need to interact with different sections. Critical for three-pane layout (agent | diff | terminal).

**Trade-offs:**
- **Pros:** Native to Ink, simple API, automatic focus queue management
- **Cons:** Limited to Tab key by default, requires custom input handling for more complex navigation

**Example:**
```typescript
// components/panels/DiffPanel.tsx
import { Box, Text, useFocus } from 'ink';

export const DiffPanel = () => {
  const { isFocused } = useFocus();

  return (
    <Box
      borderStyle={isFocused ? 'double' : 'single'}
      borderColor={isFocused ? 'cyan' : 'gray'}
      flexGrow={1}
    >
      <Text>Diff content...</Text>
    </Box>
  );
};

// components/layouts/ThreePaneLayout.tsx
export const ThreePaneLayout = () => {
  return (
    <Box width="100%" height="100%">
      <AgentPanel />  {/* Focusable */}
      <DiffPanel />   {/* Focusable */}
      <TerminalPanel /> {/* Focusable */}
    </Box>
  );
};
```

### Pattern 6: Configuration File Hierarchy

**What:** Layer configuration sources: defaults → global config → workspace config → runtime overrides. Use TypeScript for validation and type safety.

**When to use:** For all user-configurable settings (agent commands, layout preferences, keybindings).

**Trade-offs:**
- **Pros:** Flexible, clear precedence, allows per-workspace customization
- **Cons:** More complex to implement, need to handle merge conflicts

**Example:**
```typescript
// lib/config/ConfigManager.ts
import { z } from 'zod';
import { readFile } from 'fs/promises';
import { merge } from 'lodash';

const ConfigSchema = z.object({
  agents: z.object({
    claude: z.object({
      command: z.string(),
      args: z.array(z.string()),
    }),
  }),
  layout: z.object({
    agentWidth: z.number(),
    diffWidth: z.number(),
  }),
});

type Config = z.infer<typeof ConfigSchema>;

export class ConfigManager {
  private async loadConfig(path: string): Promise<Partial<Config>> {
    try {
      const content = await readFile(path, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  async resolveConfig(workspaceId?: string): Promise<Config> {
    // Layer 1: Defaults
    const defaults: Config = {
      agents: {
        claude: { command: 'claude-code', args: [] },
      },
      layout: { agentWidth: 33, diffWidth: 34 },
    };

    // Layer 2: Global config
    const globalConfig = await this.loadConfig(
      '~/.config/equipe/config.json'
    );

    // Layer 3: Workspace config
    const workspaceConfig = workspaceId
      ? await this.loadConfig(`.equipe/${workspaceId}/config.json`)
      : {};

    // Merge with precedence
    const merged = merge({}, defaults, globalConfig, workspaceConfig);

    // Validate
    return ConfigSchema.parse(merged);
  }
}
```

## Data Flow

### Request Flow

```
[User Input (Keyboard)]
    ↓
[Ink useInput Hook] → [Component Event Handler]
    ↓
[Service Method Call] → [Business Logic]
    ↓                       ↓
[Update Jotai Atom]   [External Process (Git/Agent)]
    ↓                       ↓
[React Re-render]     [Event Emitted]
    ↓                       ↓
[Updated UI]          [Other Services React]
                            ↓
                      [Update Jotai Atom]
                            ↓
                      [React Re-render]
```

### State Management Flow

```
[Service Updates State]
    ↓
[Jotai Atom Set]
    ↓
[Atom Subscribers Notified]
    ↓
[Only Affected Components Re-render]
```

### Process Lifecycle Flow

```
[User Creates Workspace]
    ↓
[WorkspaceManager.create()]
    ↓
[Git creates worktree] → [WorkspaceStore persists]
    ↓
[Emit workspace-created event]
    ↓
[AgentManager listens] → [PTYManager.spawn()]
    ↓
[Agent process starts] → [Output streams to atom]
    ↓
[AgentPanel subscribes to atom] → [Renders output]
```

### Key Data Flows

1. **Agent Output Flow:** PTY data event → PTYManager emits → AgentManager updates atom → AgentPanel re-renders visible slice
2. **Git Change Flow:** File watcher detects change → GitManager emits → DiffGenerator updates diff → Diff atom updated → DiffPanel re-renders
3. **User Command Flow:** TerminalPanel input → PTYManager.write() → Shell process receives → Output returns via PTY data event
4. **Workspace Switch Flow:** User input → WorkspaceManager.switch() → Update active workspace atom → All panels re-render with new context

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| **1-3 agents** | Single PTY process per agent, in-memory output buffers, simple event emitters |
| **4-10 agents** | Implement output streaming to disk for long sessions, add process pooling, introduce output compression |
| **10+ agents** | Consider separating UI and orchestration (IPC), implement agent queueing, add resource limits per agent |

### Scaling Priorities

1. **First bottleneck: Memory from agent outputs**
   - Symptom: TUI slows down after hours of agent output
   - Solution: Implement circular buffers (keep last N lines), stream old output to disk
   - Code: Use ringbufferjs or similar for bounded memory

2. **Second bottleneck: Too many PTY processes**
   - Symptom: System resource exhaustion with many concurrent agents
   - Solution: Process pooling, agent queueing, graceful suspension of inactive agents
   - Code: Implement agent lifecycle states (active, suspended, archived)

3. **Third bottleneck: File watcher overhead**
   - Symptom: High CPU from watching large repos
   - Solution: Debounce file events, ignore patterns more aggressively, use platform-specific optimizations
   - Code: Use chokidar with `usePolling: false` and aggressive ignore patterns

## Anti-Patterns

### Anti-Pattern 1: Sharing Node PTY Between Multiple Consumers

**What people do:** Create one PTY process and try to multiplex input/output to multiple panels or components.

**Why it's wrong:** PTY is inherently single-session. Multiplexing breaks terminal state (cursor position, colors, prompts). Each terminal session needs its own PTY.

**Do this instead:** Create one PTY per interactive session. If you need to display the same output in multiple places, duplicate the output stream, don't share the PTY.

```typescript
// BAD
const sharedPTY = pty.spawn('bash');
panel1.attachPTY(sharedPTY); // Both panels share PTY
panel2.attachPTY(sharedPTY); // Terminal state gets corrupted

// GOOD
const ptyForPanel1 = pty.spawn('bash', [], { cwd: workspace1 });
const ptyForPanel2 = pty.spawn('bash', [], { cwd: workspace2 });
panel1.attachPTY(ptyForPanel1); // Each has its own PTY
panel2.attachPTY(ptyForPanel2);
```

### Anti-Pattern 2: Blocking the Event Loop with Synchronous Operations

**What people do:** Use synchronous fs operations, execSync, or blocking loops in the main thread.

**Why it's wrong:** Ink renders on the Node.js event loop. Blocking operations freeze the UI, making it unresponsive. Users see frozen terminal output.

**Do this instead:** Use async/await for all I/O. For CPU-intensive work, use worker threads. Always return control to event loop quickly.

```typescript
// BAD
const diff = execSync('git diff').toString(); // Blocks entire UI
updateDiffAtom(diff);

// GOOD
const { stdout: diff } = await execa('git', ['diff']); // Non-blocking
updateDiffAtom(diff);
```

### Anti-Pattern 3: Storing Absolute Paths in Workspace Configs

**What people do:** Save absolute filesystem paths in workspace configuration files that get committed or shared.

**Why it's wrong:** Absolute paths break when configs are shared across machines or users. Worktrees may be in different locations.

**Do this instead:** Store relative paths or use path resolution. Resolve absolute paths at runtime based on project root or home directory.

```typescript
// BAD config
{
  "worktreePath": "/Users/alice/Projects/equipe/worktrees/feature-123"
}

// GOOD config
{
  "worktreeRelativePath": "worktrees/feature-123",
  "projectRoot": "~/Projects/equipe" // Resolved at runtime
}
```

### Anti-Pattern 4: Not Handling PTY Process Exits

**What people do:** Spawn PTY processes but don't listen for exit events or clean up resources.

**Why it's wrong:** Zombie processes accumulate, file descriptors leak, crash recovery impossible. When agent crashes, UI shows stale output.

**Do this instead:** Always attach exit listeners. Update state to reflect process termination. Clean up resources. Provide restart options.

```typescript
// BAD
ptyProcess = pty.spawn('claude-code', args);
// No exit handling, no cleanup

// GOOD
ptyProcess = pty.spawn('claude-code', args);
ptyProcess.onExit(({ exitCode, signal }) => {
  // Update state
  setAgentStatusAtom({ status: 'exited', exitCode, signal });

  // Clean up
  this.ptyProcesses.delete(agentId);

  // Log for debugging
  logger.info(`Agent ${agentId} exited`, { exitCode, signal });

  // Offer restart
  if (exitCode !== 0) {
    this.emit('agent-crashed', { agentId, exitCode });
  }
});
```

### Anti-Pattern 5: Mixing UI Logic with Business Logic

**What people do:** Put git commands, process management, or API calls directly in React components.

**Why it's wrong:** Makes components hard to test, violates separation of concerns, leads to spaghetti code. Business logic gets tangled with rendering.

**Do this instead:** Keep components pure. Business logic lives in services. Components read from atoms and call service methods.

```typescript
// BAD
export const WorkspacePanel = () => {
  const [workspaces, setWorkspaces] = useState([]);

  const createWorkspace = async (name: string) => {
    // Business logic in component!
    await execa('git', ['worktree', 'add', name]);
    const newWorkspace = { id: uuid(), name };
    await writeFile(`~/.config/equipe/${id}.json`, JSON.stringify(newWorkspace));
    setWorkspaces([...workspaces, newWorkspace]);
  };

  return <Box>...</Box>;
};

// GOOD
export const WorkspacePanel = () => {
  const workspaces = useAtomValue(workspacesAtom);
  const workspaceManager = useWorkspaceManager(); // Service hook

  const handleCreate = (name: string) => {
    workspaceManager.create(name); // Service handles business logic
  };

  return <Box>...</Box>;
};
```

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Git worktrees** | CLI via execa | Use `git worktree add/list/remove`, parse output |
| **GitHub API** | gh CLI or Octokit | Prefer gh CLI for auth simplicity, use Octokit for complex API needs |
| **Coding Agents** | PTY via node-pty | Spawn as interactive processes, capture ANSI output |
| **File System** | chokidar watcher | Watch worktree directories for changes, debounce events |
| **Terminal** | Ink + process.stdin/stdout | Ink handles rendering, raw mode for input capture |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **UI ↔ State** | Jotai atoms (read/write) | Components subscribe to atoms, services update atoms |
| **State ↔ Services** | Direct method calls + events | Services called from UI event handlers, emit events for side effects |
| **Services ↔ Processes** | PTYManager facade | Services don't touch node-pty directly, use PTYManager abstraction |
| **Services ↔ Persistence** | Store classes | Each domain has a Store (WorkspaceStore, SettingsStore) |
| **Services ↔ Services** | EventEmitter events | Loose coupling via domain events, typed with enums |

## Build Order Implications

### Phase 1: Foundation (Core Infrastructure)
**Build first:** Base services before UI
1. PTYManager (process abstraction)
2. ConfigManager (settings loading)
3. Basic Jotai atoms (workspace, ui state)
4. WorkspaceStore (persistence)

**Why:** UI components depend on these. Can't render without state management and process handling.

**Test:** Unit test each manager in isolation before integration.

### Phase 2: Business Logic (Domain Services)
**Build second:** Managers that orchestrate domain logic
1. WorkspaceManager (git worktree operations)
2. AgentManager (spawn/monitor agents)
3. GitManager (diff generation, watching)
4. PRManager (GitHub integration)

**Why:** Services need foundation but UI needs services. This layer is the business logic.

**Test:** Integration tests with real git repos (use temp directories).

### Phase 3: UI Components (Presentation)
**Build third:** React Ink components
1. Basic widgets (ScrollableBox, FocusablePane)
2. Individual panels (AgentPanel, DiffPanel, TerminalPanel)
3. Layouts (ThreePaneLayout)
4. Root App component

**Why:** Components read from atoms updated by services. Need working services to test properly.

**Test:** Render tests with Ink's testing utilities, mock atoms.

### Phase 4: Integration (Wiring)
**Build fourth:** Connect everything
1. Event wiring between services
2. Keyboard shortcuts and focus management
3. Error handling and crash recovery
4. Persistence (save/restore workspace state)

**Why:** Individual pieces work but need coordination. This is where it comes together.

**Test:** End-to-end tests with real workflows (create workspace, spawn agent, view diff).

### Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│                    Phase 4: Integration                  │
│  (Event wiring, keyboard shortcuts, error handling)      │
└─────────────────────────────────────────────────────────┘
                           ↑
                           │
┌─────────────────────────────────────────────────────────┐
│                   Phase 3: UI Components                 │
│         (Panels, Layouts, Widgets, Root App)             │
└─────────────────────────────────────────────────────────┘
                           ↑
                           │
┌─────────────────────────────────────────────────────────┐
│                Phase 2: Business Logic                   │
│  (WorkspaceManager, AgentManager, GitManager, PRManager) │
└─────────────────────────────────────────────────────────┘
                           ↑
                           │
┌─────────────────────────────────────────────────────────┐
│                   Phase 1: Foundation                    │
│    (PTYManager, ConfigManager, Atoms, Stores)            │
└─────────────────────────────────────────────────────────┘
```

**Key insight:** Build bottom-up. Each layer depends on the one below. Foundation is most stable, Integration is most volatile.

## Sources

**High Confidence (Official Documentation):**
- [Ink GitHub Repository](https://github.com/vadimdemedes/ink) - React renderer for CLIs, component model, hooks
- [node-pty GitHub Repository](https://github.com/microsoft/node-pty) - PTY process management
- [Jotai Official Documentation](https://jotai.org) - Atomic state management
- [Node.js Child Process Documentation](https://nodejs.org/api/child_process.html) - Process management patterns

**Medium Confidence (Verified Community Sources):**
- [Building Terminal Interfaces with Node.js](https://blog.openreplay.com/building-terminal-interfaces-nodejs/) - TUI architecture patterns
- [TUI Development: Ink + React](https://combray.prose.sh/2025-12-01-tui-development) - Ink architecture patterns
- [Kilo-Org/kilocode CLI Interface](https://deepwiki.com/Kilo-Org/kilocode/7-cli-interface) - Jotai + Ink integration
- [agenttools/worktree GitHub](https://github.com/agenttools/worktree) - Git worktree + agent orchestration patterns
- [Managing Child Processes in Node.js](https://www.linkedin.com/pulse/nodejs-guide-8-managing-child-processes-best-use-cases-sandaruwan-frg3c) - Process management best practices 2026
- [Git Worktree Tutorial](https://www.datacamp.com/tutorial/git-worktree-tutorial) - Worktree management patterns
- [State Management in Vanilla JS: 2026 Trends](https://medium.com/@chirag.dave/state-management-in-vanilla-js-2026-trends-f9baed7599de) - State persistence patterns

**Low Confidence (Community Patterns - Validate Before Use):**
- [Event-Driven Architecture and Reactive Programming](https://retool.com/blog/event-driven-architecture-and-reactive-programming) - Event-driven patterns
- [The Elm Architecture (TEA) | Ratatui](https://ratatui.rs/concepts/application-patterns/the-elm-architecture/) - TUI state management patterns

---
*Architecture research for: TUI Coding Agent Orchestration Platform*
*Researched: 2026-02-02*
