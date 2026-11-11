import { DataRepository } from './dataRepository';
import { ExpoFileStore } from './expoFileStore';

let instance: DataRepository | null = null;

/** Shared repository instance backed by the app's document directory. */
export function getRepository(): DataRepository {
  if (!instance) {
    instance = new DataRepository(new ExpoFileStore());
  }
  return instance;
}
