# Technology Stack Research

**Project:** equipe - TUI Agent Orchestrator
**Domain:** Terminal User Interface (TUI) for coding agent orchestration
**Researched:** 2026-02-02
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended | Confidence |
|------------|---------|---------|-----------------|------------|
| **Ink** | 5.x | TUI framework (React for CLI) | Industry standard for React-based TUIs. Used by Gatsby, GitHub Copilot, Prisma, Shopify, Claude Code. Declarative component model, Flexbox layouts via Yoga, excellent TypeScript support. 2.1M weekly downloads, 34.6k GitHub stars. | HIGH |
| **React** | 19.x | UI framework (peer dependency) | Required peer dependency for Ink. Provides familiar component model for developers. | HIGH |
| **TypeScript** | 5.x | Type safety | Project requirement. All recommended libraries have first-class TypeScript support with bundled type definitions. | HIGH |
| **Node.js** | 18+ | Runtime | Minimum v18 required for Octokit (native fetch API). Recommended v22+ (LTS). Current system: v22.13.1. | HIGH |

### Process & CLI Management

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| **execa** | 9.x | Spawn/manage CLI processes | Modern replacement for child_process. Promise-based, prevents shell injection, no escaping needed, excellent error handling, streams support, IPC for agent communication. 121M weekly downloads. v9.6.1 is latest (Jan 2026). | HIGH |
| **node-pty** | 1.1+ | Pseudoterminal (PTY) support | Microsoft-maintained. Required for interactive terminal sessions with coding agents. Allows bidirectional communication with spawned CLIs. Full TypeScript support. Used by VS Code. | HIGH |

### Git Operations

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| **simple-git** | 3.x | Git command wrapper | Pure JavaScript git wrapper with full TypeScript definitions (bundled). Supports worktree operations, clean async API. Most popular git library for Node.js. | HIGH |

### GitHub Integration

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| **octokit** | Latest | GitHub API client | Official GitHub SDK. Extensive TypeScript declarations, works in Node.js 18+, covers all GitHub platform APIs. 7.7k stars, actively maintained. All-batteries-included option. | HIGH |

### State Management

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **Zustand** | 5.x | Application state | Optional. For complex state across components. Minimal API (~1kb gzipped), React hooks integration, excellent TypeScript support. Works with Ink's React model. Use if state grows complex beyond React Context. | MEDIUM |

### UI Components & Styling

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **Ink UI** | Latest | Pre-built UI components | Companion library for Ink. Provides TextInput, Select, MultiSelect, ConfirmInput, etc. Saves time on common UI patterns. | HIGH |
| **chalk** | 5.x | Terminal string styling | Colors and text formatting. Industry standard. Note: Ink provides Box component for layout, chalk for inline text styling. | HIGH |

### CLI Utilities

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **@clack/prompts** | 0.11.x | Interactive CLI prompts | For setup flows, confirmations, inputs. Beautiful modern UI, 80% smaller than alternatives, full TypeScript support. Published Jan 2025. Preferred over enquirer for new projects. | HIGH |
| **commander** | 12.x | CLI argument parsing | For command-line flags and subcommands. Industry standard. Alternative: yargs. | HIGH |

### Development Tools

| Tool | Purpose | Notes | Confidence |
|------|---------|-------|------------|
| **create-ink-app** | Scaffolding | Bootstraps TypeScript Ink projects with proper Babel configuration (`npx create-ink-app --typescript`). Includes `@babel/preset-react` setup. | HIGH |
| **tsx** | TypeScript execution | Fast TypeScript runner for development. Alternative to ts-node. | MEDIUM |
| **vitest** | Testing | Modern, fast test runner with TypeScript support. Better than Jest for new projects. | MEDIUM |

## Installation

```bash
# Core TUI framework
npm install ink react

# Process management
npm install execa node-pty

# Git operations
npm install simple-git

# GitHub API
npm install octokit

# UI components and utilities
npm install chalk @clack/prompts commander

# Optional: State management
npm install zustand

# Dev dependencies
npm install -D typescript @types/node @types/react
npm install -D tsx vitest
```

## Alternatives Considered

| Category | Recommended | Alternative | When to Use Alternative | Confidence |
|----------|-------------|-------------|-------------------------|------------|
| **TUI Framework** | Ink | blessed/neo-blessed | If you need widget-based thinking over React components. However, blessed is unmaintained; neo-blessed/reblessed continue development but have limited TypeScript support compared to Ink. | HIGH |
| **TUI Framework** | Ink | react-blessed | Never. 678 weekly downloads vs Ink's 2.1M. Ink is the clear winner. | HIGH |
| **TUI Framework** | Ink | OpenTUI | When it leaves alpha (currently not production-ready). Promising TypeScript-first library, 100% type-safe, supports React/Solid/Vue. Watch for future. | MEDIUM |
| **Process Execution** | execa | child_process (native) | If you need zero dependencies or are already deeply integrated. But execa provides better DX, error handling, and security. | HIGH |
| **Process Execution** | execa | zx | If you're writing standalone scripts rather than an application. zx is great for Bash replacement scripts but adds shell-like syntax overhead for programmatic use. | HIGH |
| **Git Library** | simple-git | isomorphic-git | If you need browser support or pure-JS implementation. For Node.js CLI apps, simple-git is better (faster, wraps native git). | HIGH |
| **GitHub API** | octokit | @octokit/rest | If you only need REST API (subset). Use full `octokit` package for all-batteries-included experience. | HIGH |
| **CLI Prompts** | @clack/prompts | enquirer | Enquirer has broader adoption (used by eslint, webpack, yarn) but @clack/prompts is newer, smaller (80% reduction), and has better TypeScript DX. | MEDIUM |
| **CLI Prompts** | @clack/prompts | inquirer | Never. Inquirer is the old standard. @clack/prompts and enquirer are both better choices in 2025. | HIGH |

## What NOT to Use

| Avoid | Why | Use Instead | Confidence |
|-------|-----|-------------|------------|
| **blessed** (unmaintained) | Last update 2018, incompatible with modern Node, poor TypeScript support | Ink (for React model) or neo-blessed/unblessed (for blessed-compatible API with modern support) | HIGH |
| **terminal-kit** | Complex API, less intuitive than Ink, smaller community | Ink | MEDIUM |
| **stmux** | Purpose-built for package.json build scripts, not for building interactive TUIs. Side-by-side terminal multiplexing for CI/dev, not for application UX. | Ink with custom layout components + node-pty for PTY management | HIGH |
| **zx** for application code | Designed for shell scripts, not application architecture. Template-string shell syntax is great for scripts but awkward for structured apps. | execa for programmatic process execution | HIGH |
| **shelljs** | Synchronous API, blocking, outdated | execa (async, non-blocking, modern) | HIGH |
| **pty.js** | Deprecated predecessor to node-pty | node-pty | HIGH |

## Stack Patterns by Use Case

### For Agent Process Management (Core requirement)
```typescript
import { execa } from 'execa';
import * as pty from 'node-pty';

// For non-interactive agent commands (one-shot)
const { stdout } = await execa`claude-code --help`;

// For interactive agent sessions (terminal embedding)
const ptyProcess = pty.spawn('claude-code', ['chat'], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: workspacePath,
  env: process.env
});
```

**Why this combination:**
- execa for scripted commands (git operations, setup, PR creation)
- node-pty for embedding live agent terminals in TUI panes
- Both have excellent error handling and TypeScript support

### For Git Worktree Operations
```typescript
import simpleGit from 'simple-git';

const git = simpleGit('/path/to/repo');

// Create worktree
await git.raw(['worktree', 'add', '../feature-branch', 'feature-branch']);

// List worktrees
const worktrees = await git.raw(['worktree', 'list', '--porcelain']);
```

**Note:** simple-git v3 supports worktree config scope but doesn't have dedicated worktree methods. Use `.raw()` for worktree commands. This is standard practice (verified in GitHub issues).

### For Three-Pane Layout (Core requirement)
```typescript
import { Box } from 'ink';

<Box flexDirection="row" height="100%">
  {/* Left: Agent terminal */}
  <Box flexBasis="50%">
    <AgentTerminal ptyProcess={agentPty} />
  </Box>

  {/* Middle: Diff view */}
  <Box flexBasis="30%">
    <DiffView workspacePath={workspace} />
  </Box>

  {/* Right: Shell terminal */}
  <Box flexBasis="20%">
    <ShellTerminal ptyProcess={shellPty} />
  </Box>
</Box>
```

**Why Ink for this:**
- Flexbox layout system (via Yoga) handles pane sizing naturally
- React component model makes it easy to encapsulate terminal panes
- No need for separate multiplexing library (stmux) - Ink provides layout primitives

## Version Compatibility

### Critical Compatibility Notes

| Package | Requires | Notes | Confidence |
|---------|----------|-------|------------|
| **Ink** | React (peer dep) | Must install both. React version should match Ink's peerDependencies. Currently supports React 19.x. | HIGH |
| **Ink** | Babel setup | Requires `@babel/preset-react` for JSX. Use `create-ink-app --typescript` to bootstrap correctly. | HIGH |
| **octokit** | Node.js 18+ | Requires native fetch API. Also needs `tsconfig.json` with `"moduleResolution": "node16", "module": "node16"` | HIGH |
| **execa** | Node.js 18.19.0+ | Latest v9 requires modern Node. | HIGH |
| **node-pty** | Node.js 16+ or Electron 19+ | Requires native compilation. Uses Windows conpty API (Windows 1809+ build 18309+). | HIGH |
| **simple-git** | Node.js 14+ | v3 works with modern Node versions. | HIGH |

### TypeScript Configuration

Recommended `tsconfig.json` for this stack:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "node16",
    "moduleResolution": "node16",
    "lib": ["ES2022"],
    "jsx": "react",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Key settings:**
- `"module": "node16"` and `"moduleResolution": "node16"` required for octokit
- `"jsx": "react"` required for Ink
- `"strict": true` recommended for type safety

## Build & Distribution Considerations

### Native Dependencies
- **node-pty** requires native compilation (node-gyp)
- Must build for target platform (Windows/Linux/macOS)
- Consider using pkg, nexe, or electron-builder if distributing binaries

### ESM vs CommonJS
- **execa v9** is pure ESM (no CommonJS)
- All other recommended libraries support both
- Recommend ESM for new projects (`"type": "module"` in package.json)

## Sources

### HIGH Confidence (Official docs, Context7)
- [Ink GitHub Repository](https://github.com/vadimdemedes/ink) - Official docs, version info, examples
- [Execa GitHub Repository](https://github.com/sindresorhus/execa) - Official docs, v9 release notes
- [simple-git GitHub Repository](https://github.com/steveukx/git-js) - Official docs, TypeScript definitions
- [Octokit GitHub Repository](https://github.com/octokit/octokit.js) - Official docs, TypeScript configuration
- [node-pty GitHub Repository](https://github.com/microsoft/node-pty) - Official Microsoft repository, TypeScript examples
- [Node.js Child Process Documentation](https://nodejs.org/api/child_process.html) - Official Node.js docs for process management

### MEDIUM Confidence (Recent articles, npm stats, verified claims)
- [Execa 9 Release Announcement](https://medium.com/@ehmicky/execa-9-release-d0d5daaa097f) - May 2024 announcement
- [Execa Guide 2025](https://generalistprogrammer.com/tutorials/execa-npm-package-guide) - Complete package documentation
- [Ink Alternatives Comparison](https://npm-compare.com/blessed,ink) - npm download statistics, adoption data
- [@clack/prompts npm page](https://www.npmjs.com/package/@clack/prompts) - Version info, usage stats (3,117 dependent projects)
- [Building CLI Tools with @clack/prompts](https://www.blacksrc.com/blog/elevate-your-cli-tools-with-clack-prompts) - January 2025 article
- [TUI Development: Ink + React](https://combray.prose.sh/2025-12-01-tui-development) - Recent best practices
- [Creating Terminal Applications with Ink + React + TypeScript](https://medium.com/@pixelreverb/creating-a-terminal-application-with-ink-react-typescript-an-introduction-da49f3c012a8) - August 2024 tutorial

### Community Resources
- [awesome-tuis GitHub Repository](https://github.com/rothgar/awesome-tuis) - Curated list of TUI projects
- [7 TUI Libraries for Interactive Terminal Apps](https://blog.logrocket.com/7-tui-libraries-interactive-terminal-apps/) - LogRocket comparison
- [npm trends: blessed vs ink vs terminal-in-react](https://npmtrends.com/blessed-vs-ink-vs-terminal-in-react-vs-terminal-kit-vs-terminal-ui) - Download trends, adoption metrics

---

**Stack research for:** TypeScript TUI for agent orchestration with git worktrees and GitHub integration
**Researched:** 2026-02-02
**Next steps:** Review architecture patterns for component boundaries and process lifecycle management
