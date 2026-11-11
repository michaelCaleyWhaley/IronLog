import { ulid } from 'ulid';

/** Generates a client-side ULID: stable, unique, roughly time-sortable. */
export function newId(): string {
  return ulid();
}
