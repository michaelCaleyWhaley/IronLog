export class RepositoryNotInitialisedError extends Error {
  constructor() {
    super('Data repository has not been initialised');
    this.name = 'RepositoryNotInitialisedError';
  }
}

/** Neither the primary file nor the backup copy could be parsed/validated. */
export class DataCorruptedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DataCorruptedError';
  }
}

/** The stored document is not valid JSON or fails schema validation. */
export class InvalidDocumentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'InvalidDocumentError';
  }
}

/** The stored document was written by a newer app version. */
export class FutureSchemaVersionError extends Error {
  readonly foundVersion: number;
  readonly supportedVersion: number;

  constructor(foundVersion: number, supportedVersion: number) {
    super(
      `Data file uses schema version ${foundVersion}, but this app only supports up to version ${supportedVersion}. The file was likely created by a newer version of the app.`,
    );
    this.name = 'FutureSchemaVersionError';
    this.foundVersion = foundVersion;
    this.supportedVersion = supportedVersion;
  }
}

/** An older document needs a migration that is not registered. */
export class MissingMigrationError extends Error {
  readonly fromVersion: number;

  constructor(fromVersion: number) {
    super(`No migration registered for schema version ${fromVersion}`);
    this.name = 'MissingMigrationError';
    this.fromVersion = fromVersion;
  }
}

/** A mutation produced a document that fails validation. */
export class DataValidationError extends Error {
  readonly issues: unknown;

  constructor(message: string, issues?: unknown) {
    super(message);
    this.name = 'DataValidationError';
    this.issues = issues;
  }
}

/** An import payload was rejected before touching stored data. */
export class ImportValidationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'ImportValidationError';
  }
}
