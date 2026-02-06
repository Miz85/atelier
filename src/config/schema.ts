export interface AtelierConfig {
  ideCommand: string;      // Command to open IDE (default: 'code')
  defaultAgent: 'claude' | 'opencode';  // Default coding agent
  // Future: workspaces will be stored separately via Jotai persistence
}

export const configDefaults: AtelierConfig = {
  ideCommand: 'code',
  defaultAgent: 'claude',
};
