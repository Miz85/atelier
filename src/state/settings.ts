// src/state/settings.ts
import { atomWithStorage } from 'jotai/utils';
import { createJotaiStorage } from '../config/storage.js';

/**
 * User settings stored via Jotai (separate from conf for reactive updates).
 * Note: This duplicates some conf settings to enable reactive UI updates.
 * The conf store remains source of truth; this syncs on app start.
 */
export interface Settings {
  ideCommand: string;
  defaultAgent: 'claude' | 'opencode';
}

export const settingsDefaults: Settings = {
  ideCommand: 'code',
  defaultAgent: 'claude',
};

/**
 * Persistent settings atom.
 * Persists to ~/.atelier/state/settings.json
 */
export const settingsAtom = atomWithStorage<Settings>(
  'settings',
  settingsDefaults,
  createJotaiStorage<Settings>(),
  { getOnInit: true }
);
