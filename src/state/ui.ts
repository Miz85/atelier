// src/state/ui.ts
import { atom } from 'jotai';

/**
 * UI state atom for help modal visibility.
 * Controls whether the keyboard shortcuts help screen is shown.
 * No persistence needed - help visibility resets on app restart.
 */
export const showHelpAtom = atom(false);
