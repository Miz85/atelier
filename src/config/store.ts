import Conf from 'conf';
import { AtelierConfig, configDefaults } from './schema.js';

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

export const config = new Conf<AtelierConfig>({
  projectName: 'atelier',
  schema,
  // XDG-compliant by default: ~/.config/atelier on Linux, ~/Library/Preferences on macOS
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
export function getConfig(): AtelierConfig {
  return config.store;
}
