import type { ExerciseInput, ExercisePatch } from '../domain/exercises';
import {
  addCustomExercise,
  softDeleteExercise,
  updateCustomExercise,
} from '../domain/exercises';
import { createInitialDocument } from '../domain/initialDocument';
import type { PreferencesPatch } from '../domain/preferences';
import { updatePreferences } from '../domain/preferences';
import type { RoutineInput, RoutinePatch } from '../domain/routines';
import { addRoutine, deleteRoutine, updateRoutine } from '../domain/routines';
import { safeParseAppData } from '../domain/schemas';
import type {
  AppData,
  Exercise,
  Preferences,
  Routine,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '../domain/types';
import { CURRENT_SCHEMA_VERSION } from '../domain/types';
import type { WorkoutSetPatch } from '../domain/workouts';
import {
  addExerciseToWorkout,
  addSetToWorkout,
  completeWorkout,
  discardWorkout,
  moveWorkoutExercise,
  removeExerciseFromWorkout,
  removeSetFromWorkout,
  startBlankWorkout,
  startWorkoutFromRoutine,
  updateWorkoutSet,
} from '../domain/workouts';
import {
  DataCorruptedError,
  DataValidationError,
  FutureSchemaVersionError,
  ImportValidationError,
  InvalidDocumentError,
  RepositoryNotInitialisedError,
} from './errors';
import type { Migration } from './migrations';
import { migrateDocument } from './migrations';
import type { KeyValueStore } from './storageAdapter';

export const PRIMARY_KEY = 'ironlog-data.json';
export const BACKUP_KEY = 'ironlog-data.backup.json';
export const TEMP_KEY = 'ironlog-data.tmp.json';

export type LoadStatus = 'created' | 'loaded' | 'recovered';

export interface LoadResult {
  status: LoadStatus;
  /** Human-readable note, e.g. when data was restored from backup. */
  message?: string;
}

export interface RepositoryOptions {
  /** Override registered migrations (mainly for tests). */
  migrations?: Record<number, Migration>;
  /** Clock injection for deterministic tests. */
  now?: () => Date;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Central repository: the only application-level interface for persisted
 * data. Owns the in-memory document, serialises all writes, and writes
 * through a temp file + rename with a retained backup copy.
 */
export class DataRepository {
  private current: AppData | null = null;
  private queue: Promise<void> = Promise.resolve();
  private initPromise: Promise<LoadResult> | null = null;
  private readonly store: KeyValueStore;
  private readonly migrations?: Record<number, Migration>;
  private readonly now: () => Date;

  constructor(store: KeyValueStore, options: RepositoryOptions = {}) {
    this.store = store;
    this.migrations = options.migrations;
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Loads the document from storage, creating the initial document on
   * first launch and recovering from the backup copy when the primary
   * file is unreadable. Throws DataCorruptedError when neither copy is
   * usable — damaged files are left in place for manual recovery.
   */
  async initialise(): Promise<LoadResult> {
    if (this.current) {
      return { status: 'loaded' };
    }
    if (!this.initPromise) {
      // Share one in-flight initialisation; allow retry after failure.
      this.initPromise = this.doInitialise().catch((error: unknown) => {
        this.initPromise = null;
        throw error;
      });
    }
    return this.initPromise;
  }

  private async doInitialise(): Promise<LoadResult> {
    const primaryText = await this.store.read(PRIMARY_KEY);
    if (primaryText === null) {
      this.current = createInitialDocument(this.now());
      await this.writeSnapshot(this.current, false);
      return { status: 'created' };
    }

    try {
      const { data, migrated } = this.parseDocument(primaryText);
      this.current = data;
      if (migrated) {
        // Persist the migrated document; refreshBackup copies the
        // pre-migration primary into the backup slot first.
        await this.enqueueWrite();
      }
      return { status: 'loaded' };
    } catch (error) {
      if (error instanceof FutureSchemaVersionError) {
        throw error;
      }
      return this.recoverFromBackup(error);
    }
  }

  private async recoverFromBackup(primaryError: unknown): Promise<LoadResult> {
    const backupText = await this.store.read(BACKUP_KEY);
    if (backupText !== null) {
      try {
        const { data } = this.parseDocument(backupText);
        this.current = data;
        // Restore the primary file without refreshing the backup from the
        // corrupt primary, then rewrite the backup with the good copy.
        await this.enqueueWrite(false);
        await this.store.write(BACKUP_KEY, this.serialize(data));
        return {
          status: 'recovered',
          message:
            'The primary data file was unreadable, so the previous backup was restored.',
        };
      } catch {
        // Fall through to the corruption error below.
      }
    }
    throw new DataCorruptedError(
      'The local data file is damaged and no usable backup exists. The damaged file has been preserved.',
      { cause: primaryError },
    );
  }

  /** Returns a deep copy of the current document. */
  getData(): AppData {
    this.requireInitialised();
    return clone(this.current as AppData);
  }

  /**
   * Applies a mutation to a working copy of the document, validates the
   * result, updates in-memory state, then persists serially. If
   * validation fails the in-memory document is left untouched. If the
   * write fails, in-memory state is retained so nothing is lost.
   */
  async update(mutator: (draft: AppData) => void): Promise<void> {
    this.requireInitialised();
    const next = clone(this.current as AppData);
    mutator(next);
    next.updatedAt = this.now().toISOString();

    const result = safeParseAppData(next);
    if (!result.success) {
      throw new DataValidationError(
        'The change produced invalid data',
        result.error.issues,
      );
    }
    this.current = result.data as AppData;
    await this.enqueueWrite();
  }

  /** Serialises the current document as pretty-printed JSON. */
  exportJson(): string {
    this.requireInitialised();
    return this.serialize(this.current as AppData);
  }

  /**
   * Validates an imported JSON backup (including migrations for older
   * schema versions) and atomically replaces the stored document. On any
   * failure the current data is preserved.
   */
  async importJson(text: string): Promise<void> {
    this.requireInitialised();
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      throw new ImportValidationError('Import is not valid JSON', {
        cause: error,
      });
    }

    const { data } = this.parseImport(raw);

    // Write through the serialised queue so the import cannot be overtaken
    // by an older queued write. Only swap in-memory state after the write
    // succeeds.
    await this.enqueue(async () => {
      await this.writeSnapshot(data, true);
      this.current = data;
    });
  }

  // ---- Exercises -------------------------------------------------------

  async createExercise(input: ExerciseInput): Promise<Exercise> {
    const holder: { exercise?: Exercise } = {};
    await this.update((draft) => {
      holder.exercise = addCustomExercise(
        draft,
        input,
        this.now().toISOString(),
      );
    });
    return holder.exercise as Exercise;
  }

  async updateExercise(
    exerciseId: string,
    patch: ExercisePatch,
  ): Promise<Exercise> {
    const holder: { exercise?: Exercise } = {};
    await this.update((draft) => {
      holder.exercise = updateCustomExercise(
        draft,
        exerciseId,
        patch,
        this.now().toISOString(),
      );
    });
    return holder.exercise as Exercise;
  }

  async deleteExercise(exerciseId: string): Promise<void> {
    await this.update((draft) => {
      softDeleteExercise(draft, exerciseId, this.now().toISOString());
    });
  }

  // ---- Routines --------------------------------------------------------

  async createRoutine(input: RoutineInput): Promise<Routine> {
    const holder: { routine?: Routine } = {};
    await this.update((draft) => {
      holder.routine = addRoutine(draft, input, this.now().toISOString());
    });
    return holder.routine as Routine;
  }

  async updateRoutine(
    routineId: string,
    patch: RoutinePatch,
  ): Promise<Routine> {
    const holder: { routine?: Routine } = {};
    await this.update((draft) => {
      holder.routine = updateRoutine(
        draft,
        routineId,
        patch,
        this.now().toISOString(),
      );
    });
    return holder.routine as Routine;
  }

  async deleteRoutine(routineId: string): Promise<void> {
    await this.update((draft) => {
      deleteRoutine(draft, routineId);
    });
  }

  // ---- Preferences -----------------------------------------------------

  async updatePreferences(patch: PreferencesPatch): Promise<Preferences> {
    const holder: { preferences?: Preferences } = {};
    await this.update((draft) => {
      holder.preferences = updatePreferences(draft, patch);
    });
    return holder.preferences as Preferences;
  }

  // ---- Workouts --------------------------------------------------------

  async startBlankWorkout(name?: string): Promise<Workout> {
    const holder: { workout?: Workout } = {};
    await this.update((draft) => {
      holder.workout = startBlankWorkout(draft, name, this.now().toISOString());
    });
    return holder.workout as Workout;
  }

  async startWorkoutFromRoutine(routineId: string): Promise<Workout> {
    const holder: { workout?: Workout } = {};
    await this.update((draft) => {
      holder.workout = startWorkoutFromRoutine(
        draft,
        routineId,
        this.now().toISOString(),
      );
    });
    return holder.workout as Workout;
  }

  async addExerciseToWorkout(
    workoutId: string,
    exerciseId: string,
  ): Promise<WorkoutExercise> {
    const holder: { entry?: WorkoutExercise } = {};
    await this.update((draft) => {
      holder.entry = addExerciseToWorkout(
        draft,
        workoutId,
        exerciseId,
        this.now().toISOString(),
      );
    });
    return holder.entry as WorkoutExercise;
  }

  async removeExerciseFromWorkout(
    workoutId: string,
    exerciseId: string,
  ): Promise<void> {
    await this.update((draft) => {
      removeExerciseFromWorkout(
        draft,
        workoutId,
        exerciseId,
        this.now().toISOString(),
      );
    });
  }

  async addSetToWorkout(
    workoutId: string,
    exerciseId: string,
  ): Promise<WorkoutSet> {
    const holder: { set?: WorkoutSet } = {};
    await this.update((draft) => {
      holder.set = addSetToWorkout(
        draft,
        workoutId,
        exerciseId,
        this.now().toISOString(),
      );
    });
    return holder.set as WorkoutSet;
  }

  async removeSetFromWorkout(
    workoutId: string,
    exerciseId: string,
    setId: string,
  ): Promise<void> {
    await this.update((draft) => {
      removeSetFromWorkout(
        draft,
        workoutId,
        exerciseId,
        setId,
        this.now().toISOString(),
      );
    });
  }

  async updateWorkoutSet(
    workoutId: string,
    exerciseId: string,
    setId: string,
    patch: WorkoutSetPatch,
  ): Promise<WorkoutSet> {
    const holder: { set?: WorkoutSet } = {};
    await this.update((draft) => {
      holder.set = updateWorkoutSet(
        draft,
        workoutId,
        exerciseId,
        setId,
        patch,
        this.now().toISOString(),
      );
    });
    return holder.set as WorkoutSet;
  }

  async moveWorkoutExercise(
    workoutId: string,
    exerciseId: string,
    direction: -1 | 1,
  ): Promise<void> {
    await this.update((draft) => {
      moveWorkoutExercise(
        draft,
        workoutId,
        exerciseId,
        direction,
        this.now().toISOString(),
      );
    });
  }

  async completeWorkout(workoutId: string): Promise<Workout> {
    const holder: { workout?: Workout } = {};
    await this.update((draft) => {
      holder.workout = completeWorkout(
        draft,
        workoutId,
        this.now().toISOString(),
      );
    });
    return holder.workout as Workout;
  }

  async discardWorkout(workoutId: string): Promise<void> {
    await this.update((draft) => {
      discardWorkout(draft, workoutId);
    });
  }

  // ---------------------------------------------------------------------

  private requireInitialised(): void {
    if (!this.current) {
      throw new RepositoryNotInitialisedError();
    }
  }

  private serialize(doc: AppData): string {
    return JSON.stringify(doc, null, 2);
  }

  /** Parses, migrates and validates a stored document. */
  private parseDocument(text: string): {
    data: AppData;
    migrated: boolean;
  } {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch (error) {
      throw new InvalidDocumentError('Document is not valid JSON', {
        cause: error,
      });
    }
    return this.migrateAndValidate(raw);
  }

  /** Same pipeline as parseDocument but for import payloads. */
  private parseImport(raw: unknown): {
    data: AppData;
    migrated: boolean;
  } {
    return this.migrateAndValidate(raw);
  }

  private migrateAndValidate(raw: unknown): {
    data: AppData;
    migrated: boolean;
  } {
    const { data: migratedDoc, migrated } = migrateDocument(raw, {
      migrations: this.migrations,
    });
    const result = safeParseAppData(migratedDoc);
    if (!result.success) {
      throw new InvalidDocumentError('Document failed schema validation', {
        cause: result.error.issues,
      });
    }
    const data = {
      ...(result.data as AppData),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
    return { data, migrated };
  }

  /**
   * Serialised write chain. Each enqueued task reads `this.current` (or an
   * explicit snapshot) at execution time, so the file always converges to
   * the newest complete state even if writes complete out of order.
   */
  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private enqueueWrite(refreshBackup = true): Promise<void> {
    return this.enqueue(async () => {
      this.requireInitialised();
      await this.writeSnapshot(this.current as AppData, refreshBackup);
    });
  }

  /**
   * Safe write: snapshot the document to the temp file, then rename it
   * over the primary file. When refreshBackup is set, the previous
   * primary content is copied to the backup slot first so a known-good
   * copy always exists.
   */
  private async writeSnapshot(
    doc: AppData,
    refreshBackup: boolean,
  ): Promise<void> {
    const json = this.serialize(doc);
    if (refreshBackup) {
      const existing = await this.store.read(PRIMARY_KEY);
      if (existing !== null) {
        await this.store.write(BACKUP_KEY, existing);
      }
    }
    await this.store.write(TEMP_KEY, json);
    await this.store.move(TEMP_KEY, PRIMARY_KEY);
  }
}
