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

/**
 * v1 -> v2: routine exercises changed from `targetSets`/`targetReps`
 * counts to a per-set `sets` array of { reps?, weightKg? } targets.
 * Each prescribed set inherits the old targetReps; weight is unset.
 */
const migrateV1ToV2: Migration = (data) => {
  const doc = data as {
    schemaVersion?: unknown;
    routines?: {
      exercises?: {
        exerciseId: string;
        order: number;
        targetSets?: number;
        targetReps?: number;
        sets?: unknown;
      }[];
    }[];
  };
  return {
    ...doc,
    schemaVersion: 2,
    routines: (doc.routines ?? []).map((routine) => ({
      ...routine,
      exercises: (routine.exercises ?? []).map((exercise) => {
        if (Array.isArray(exercise.sets)) {
          return exercise;
        }
        const count = Math.max(0, Math.floor(exercise.targetSets ?? 0));
        return {
          exerciseId: exercise.exerciseId,
          order: exercise.order,
          sets: Array.from({ length: count }, () => ({
            reps: exercise.targetReps,
          })),
        };
      }),
    })),
  };
};

export const MIGRATIONS: Record<number, Migration> = {
  1: migrateV1ToV2,
};

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
