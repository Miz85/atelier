export interface EquipeConfig {
  ideCommand: string;      // Command to open IDE (default: 'code')
  defaultAgent: 'claude' | 'opencode';  // Default coding agent
  // Future: workspaces will be stored separately via Jotai persistence
}

export const configDefaults: EquipeConfig = {
  ideCommand: 'code',
  defaultAgent: 'claude',
};
