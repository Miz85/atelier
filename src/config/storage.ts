// src/config/storage.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import writeFileAtomic from 'write-file-atomic';

/**
 * Custom storage adapter for Jotai's atomWithStorage in Node.js.
 * Uses write-file-atomic for safe persistence (prevents corruption on crash).
 */
export class FileSystemStorage {
  private storageDir: string;

  constructor(storageDir?: string) {
    // Default: ~/.equipe/state (XDG-adjacent, simple for CLI tool)
    this.storageDir = storageDir ?? path.join(os.homedir(), '.equipe', 'state');

    // Ensure storage directory exists
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key for filesystem safety
    const sanitized = key.replace(/[^a-zA-Z0-9-_]/g, '-');
    return path.join(this.storageDir, `${sanitized}.json`);
  }

  getItem<T>(key: string, initialValue: T): T {
    const filePath = this.getFilePath(key);
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data) as T;
      }
    } catch (error) {
      console.error(`Error reading ${key} from storage:`, error);
    }
    return initialValue;
  }

  setItem<T>(key: string, value: T): void {
    const filePath = this.getFilePath(key);
    try {
      // Use write-file-atomic to prevent corruption on crash/power loss
      const data = JSON.stringify(value, null, 2);
      writeFileAtomic.sync(filePath, data, { encoding: 'utf-8' });
    } catch (error) {
      console.error(`Error writing ${key} to storage:`, error);
    }
  }

  removeItem(key: string): void {
    const filePath = this.getFilePath(key);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`Error removing ${key} from storage:`, error);
    }
  }

  // Required by Jotai's createJSONStorage
  subscribe(key: string, callback: (value: unknown) => void, initialValue: unknown): () => void {
    // For single-process CLI, no cross-process sync needed
    // Return no-op unsubscribe
    return () => {};
  }
}

// Global singleton for app-wide usage
export const fsStorage = new FileSystemStorage();

/**
 * Create Jotai-compatible storage wrapper.
 * Usage: atomWithStorage('key', defaultValue, createJotaiStorage())
 */
export function createJotaiStorage<T>() {
  return {
    getItem: (key: string, initialValue: T): T => fsStorage.getItem(key, initialValue),
    setItem: (key: string, value: T): void => fsStorage.setItem(key, value),
    removeItem: (key: string): void => fsStorage.removeItem(key),
    subscribe: fsStorage.subscribe.bind(fsStorage),
  };
}
