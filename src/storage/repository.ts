import * as Crypto from 'expo-crypto';

import { setRandomBytes } from '../domain/id';
import { DataRepository } from './dataRepository';
import { ExpoFileStore } from './expoFileStore';

// Provide a cryptographic RNG for ID generation on native platforms.
setRandomBytes((length) => Crypto.getRandomBytes(length));

let instance: DataRepository | null = null;

/** Shared repository instance backed by the app's document directory. */
export function getRepository(): DataRepository {
  if (!instance) {
    instance = new DataRepository(new ExpoFileStore());
  }
  return instance;
}
