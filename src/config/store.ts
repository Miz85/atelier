import Conf from 'conf';
import { EquipeConfig, configDefaults } from './schema.js';

const schema = {
  ideCommand: {
    type: 'string' as const,
    default: configDefaults.ideCommand,
  },
  defaultAgent: {
    type: 'string' as const,
    enum: ['claude', 'opencode'],
    default: configDefaults.defaultAgent,
  },
};

export const config = new Conf<EquipeConfig>({
  projectName: 'equipe',
  schema,
  // XDG-compliant by default: ~/.config/equipe on Linux, ~/Library/Preferences on macOS
});

// Typed accessors for CONF-01
export function getIdeCommand(): string {
  return config.get('ideCommand');
}

export function setIdeCommand(command: string): void {
  config.set('ideCommand', command);
}

// Typed accessors for CONF-02
export function getDefaultAgent(): 'claude' | 'opencode' {
  return config.get('defaultAgent');
}

export function setDefaultAgent(agent: 'claude' | 'opencode'): void {
  config.set('defaultAgent', agent);
}

// Bulk access
export function getConfig(): EquipeConfig {
  return config.store;
}
