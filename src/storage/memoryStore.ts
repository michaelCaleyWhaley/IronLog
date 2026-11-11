import type { KeyValueStore } from './storageAdapter';

/**
 * In-memory KeyValueStore used by unit tests. Also usable as a fallback
 * or for non-native contexts.
 */
export class MemoryStore implements KeyValueStore {
  private files = new Map<string, string>();

  /** Test hook: when set, write() calls this and propagates any throw. */
  onWrite?: (key: string, contents: string) => void;

  async read(key: string): Promise<string | null> {
    return this.files.get(key) ?? null;
  }

  async write(key: string, contents: string): Promise<void> {
    this.onWrite?.(key, contents);
    this.files.set(key, contents);
  }

  async move(sourceKey: string, destinationKey: string): Promise<void> {
    const contents = this.files.get(sourceKey);
    if (contents === undefined) {
      throw new Error(`Cannot move missing key "${sourceKey}"`);
    }
    this.files.set(destinationKey, contents);
    this.files.delete(sourceKey);
  }

  /** Test helpers ---------------------------------------------------- */

  seed(key: string, contents: string): void {
    this.files.set(key, contents);
  }

  contents(key: string): string | null {
    return this.files.get(key) ?? null;
  }

  keys(): string[] {
    return [...this.files.keys()];
  }
}
