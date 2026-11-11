import { File, Paths } from 'expo-file-system';

import type { KeyValueStore } from './storageAdapter';

function fileFor(key: string): File {
  return new File(Paths.document, key);
}

/**
 * KeyValueStore backed by the app's private document directory
 * (expo-file-system). `move` maps to a same-directory rename, which is
 * atomic on both iOS and Android filesystems.
 */
export class ExpoFileStore implements KeyValueStore {
  async read(key: string): Promise<string | null> {
    const file = fileFor(key);
    return file.exists ? file.text() : null;
  }

  async write(key: string, contents: string): Promise<void> {
    const file = fileFor(key);
    if (!file.exists) {
      file.create({ overwrite: true });
    }
    await file.write(contents);
  }

  async move(sourceKey: string, destinationKey: string): Promise<void> {
    await fileFor(sourceKey).move(fileFor(destinationKey), {
      overwrite: true,
    });
  }
}
