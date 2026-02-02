# equipe

## What This Is

A terminal UI for orchestrating coding agents (Claude Code, OpenCode) across isolated git worktrees. Create a workspace, get a dedicated branch and agent instance, see what the agent changed, and manage PRs — all from one interface.

## Core Value

Quickly spin up and switch between isolated coding agent workspaces without losing context or stepping on each other's work.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Create workspace with branch name → sets up git worktree + launches coding agent
- [ ] List workspaces showing repo and branch for quick orientation
- [ ] Three-pane workspace view: agent CLI | diff summary | terminal
- [ ] PR integration: show if branch has open PR, link to it (GitHub via `gh` CLI)
- [ ] Open workspace directory in IDE via configurable command
- [ ] Support Claude Code and OpenCode as coding agents
- [ ] Global default agent with per-workspace override
- [ ] Configurable IDE command in settings

### Out of Scope

- Multi-repo support — single repo focus for v1, expand later
- Agents other than Claude Code and OpenCode — start with two, add more based on demand
- Non-GitHub PR integration — GitHub-first via `gh` CLI, other forges later
- Web or desktop UI — TUI only for v1

## Context

- Target users: developers who use AI coding agents and want to run multiple tasks in parallel
- Git worktrees provide true isolation (separate working directory per branch)
- Claude Code and OpenCode are both CLI-based, can be embedded/attached to the TUI
- The `gh` CLI handles GitHub authentication and PR operations
- Ink (React for CLIs) provides familiar component patterns for building the TUI

## Constraints

- **Tech stack**: TypeScript + Ink — chosen for React-like DX and ecosystem
- **Git dependency**: Requires git with worktree support (2.5+)
- **GitHub dependency**: PR features require `gh` CLI installed and authenticated
- **Agent dependency**: Requires Claude Code and/or OpenCode installed

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TUI over desktop/web | Developer tool, terminal-native workflow, simpler to ship | — Pending |
| TypeScript + Ink | React patterns, good DX, familiar to many devs | — Pending |
| Git worktrees for isolation | True filesystem isolation, no branch switching conflicts | — Pending |
| GitHub-only for v1 | Most common, `gh` CLI is mature, can expand later | — Pending |
| Single repo for v1 | Simpler UX, multi-repo adds complexity | — Pending |

---
*Last updated: 2025-02-02 after initialization*
