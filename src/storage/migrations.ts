import { CURRENT_SCHEMA_VERSION } from '../domain/types';
import {
  FutureSchemaVersionError,
  InvalidDocumentError,
  MissingMigrationError,
} from './errors';

/**
 * A migration upgrades a stored document from `fromVersion` to
 * `fromVersion + 1`. Migrations receive the raw parsed JSON and must
 * return the upgraded document (including the bumped `schemaVersion`).
 *
 * Register real migrations here as the schema evolves. Keyed by the
 * version being upgraded FROM.
 */
export type Migration = (data: unknown) => unknown;

export const MIGRATIONS: Record<number, Migration> = {};

export interface MigrationContext {
  migrations?: Record<number, Migration>;
}

export interface MigratedDocument {
  data: unknown;
  migrated: boolean;
}

/**
 * Validates the schema version of a parsed document and applies any
 * required migrations. Throws FutureSchemaVersionError for documents
 * from newer app versions and MissingMigrationError when an older
 * document has no registered migration path.
 */
export function migrateDocument(
  raw: unknown,
  context: MigrationContext = {},
): MigratedDocument {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new InvalidDocumentError('Document is not a JSON object');
  }

  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 0
  ) {
    throw new InvalidDocumentError('Document is missing a valid schemaVersion');
  }

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new FutureSchemaVersionError(version, CURRENT_SCHEMA_VERSION);
  }

  if (version === CURRENT_SCHEMA_VERSION) {
    return { data: raw, migrated: false };
  }

  const migrations = context.migrations ?? MIGRATIONS;
  let doc: unknown = raw;
  for (let v = version; v < CURRENT_SCHEMA_VERSION; v += 1) {
    const migrate = migrations[v];
    if (!migrate) {
      throw new MissingMigrationError(v);
    }
    doc = migrate(doc);
  }
  return { data: doc, migrated: true };
}
