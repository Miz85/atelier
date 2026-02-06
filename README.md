# atelier-cli

> Manage multiple AI agent workspaces with git worktrees

**atelier** is a terminal UI for managing multiple git worktree-based workspaces, each with its own AI agent (Claude, Cursor, etc.). Think of it as a command center for coordinating multiple agents working on different branches simultaneously.

## Features

- 📋 **Workspace Table View** - See all workspaces, their branches, changes, and agent status at a glance
- 🌳 **Git Worktree Integration** - Each workspace is a separate git worktree with its own branch
- 🤖 **Multi-Agent Support** - Run Claude, Cursor, or other AI agents in dedicated workspaces
- 📊 **Diff Summaries** - View uncommitted and committed changes inline
- 🔍 **Detailed Diff Viewer** - Browse file trees and view diffs with syntax highlighting
- 🖥️ **Terminal Sessions** - Attach to agent or terminal tmux sessions for each workspace
- ⌨️ **Keyboard-Driven** - Vim-style navigation (j/k) for efficient workflow

## Installation

```bash
npm install -g atelier-cli
```

Or run without installing:

```bash
npx atelier-cli
```

## Requirements

- Node.js >= 18.0.0
- Git
- tmux (for session management)

## Usage

Navigate to a git repository and run:

```bash
atelier
```

### Keyboard Shortcuts

**Main Screen:**
- `j/k` or `↑/↓` - Navigate workspaces
- `Enter` - Open workspace and attach to agent
- `a` - Attach to agent session
- `t` - Attach to terminal session
- `d` - View detailed diff
- `x` - Delete workspace
- `n` - Create new workspace
- `s` - Settings
- `q` - Quit

**Diff View:**
- `Tab` - Switch between file tree and diff pane
- `j/k` - Navigate files/scroll
- `Enter` - Expand/collapse directory
- `Ctrl+d/u` - Page up/down (in diff pane)
- `g/G` - Jump to top/bottom
- `Esc` or `b` - Go back

## How It Works

atelier uses **git worktrees** to create isolated working directories for each branch. This allows you to:

1. Work on multiple branches simultaneously without switching contexts
2. Run different AI agents on different features in parallel
3. Keep each workspace's state independent (uncommitted changes, running processes, etc.)

Each workspace can have its own:
- Git branch and working directory
- Running AI agent (Claude, Cursor, etc.)
- Terminal session
- Uncommitted changes

## Configuration

Settings are stored in `~/.config/atelier/config.json`:

- `defaultAgent` - Default AI agent for new workspaces (claude, cursor, opencode)
- `ideCommand` - Command to open files in your IDE

## License

MIT
