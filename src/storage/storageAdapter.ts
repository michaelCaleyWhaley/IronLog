/**
 * Minimal key-value file store scoped to a single directory.
 *
 * The repository orchestrates primary/backup/temp files on top of this;
 * implementations only need to provide primitive file operations.
 */
export interface KeyValueStore {
  /** Returns the file contents, or null when the key does not exist. */
  read(key: string): Promise<string | null>;
  write(key: string, contents: string): Promise<void>;
  /** Moves `sourceKey` to `destinationKey`, overwriting the destination. */
  move(sourceKey: string, destinationKey: string): Promise<void>;
}
