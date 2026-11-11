import { describe, expect, it } from 'vitest';

import { createInitialDocument } from '../domain/initialDocument';
import type { AppData } from '../domain/types';
import { BACKUP_KEY, DataRepository, PRIMARY_KEY } from './dataRepository';
import {
  DataCorruptedError,
  DataValidationError,
  FutureSchemaVersionError,
  ImportValidationError,
  InvalidDocumentError,
} from './errors';
import { MemoryStore } from './memoryStore';
import { MIGRATIONS } from './migrations';

const FIXED_NOW = new Date('2026-11-10T12:00:00.000Z');

function makeRepository(store = new MemoryStore()) {
  return {
    store,
    repo: new DataRepository(store, { now: () => FIXED_NOW }),
  };
}

function validDocumentJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    ...createInitialDocument(FIXED_NOW),
    ...overrides,
  });
}

describe('DataRepository.initialise', () => {
  it('creates an initial document when no file exists', async () => {
    const { repo, store } = makeRepository();
    const result = await repo.initialise();

    expect(result.status).toBe('created');
    const data = repo.getData();
    expect(data.schemaVersion).toBe(2);
    expect(data.exercises.length).toBeGreaterThan(50);
    expect(data.exercises.every((e) => !e.isCustom)).toBe(true);
    expect(data.preferences).toEqual({
      weightUnit: 'kg',
      autoStartRestTimer: false,
      defaultRestDuration: 120,
    });
    expect(store.contents(PRIMARY_KEY)).not.toBeNull();
  });

  it('loads an existing valid document', async () => {
    const { repo: first, store } = makeRepository();
    await first.initialise();
    await first.update((draft) => {
      draft.preferences.defaultRestDuration = 90;
    });

    const { repo: second } = makeRepository(store);
    const result = await second.initialise();
    expect(result.status).toBe('loaded');
    expect(second.getData().preferences.defaultRestDuration).toBe(90);
  });
});

describe('writes', () => {
  it('round-trips data through storage', async () => {
    const { repo, store } = makeRepository();
    await repo.initialise();
    await repo.update((draft) => {
      draft.routines.push({
        routineId: 'routine-1',
        name: 'Push Day',
        exercises: [
          {
            exerciseId: 'push-up',
            order: 0,
            sets: [{ reps: 10 }, { reps: 10 }, { reps: 10 }],
          },
        ],
        createdAt: FIXED_NOW.toISOString(),
        updatedAt: FIXED_NOW.toISOString(),
      });
    });

    const { repo: reloaded } = makeRepository(store);
    await reloaded.initialise();
    expect(reloaded.getData().routines[0]?.name).toBe('Push Day');
  });

  it('serialises rapid writes so the newest state wins', async () => {
    const { repo, store } = makeRepository();
    await repo.initialise();

    // Fire several updates without awaiting each one.
    const writes = [30, 60, 90, 120].map((seconds) =>
      repo.update((draft) => {
        draft.preferences.defaultRestDuration = seconds;
      }),
    );
    await Promise.all(writes);

    const stored = JSON.parse(store.contents(PRIMARY_KEY) ?? '{}') as AppData;
    expect(stored.preferences.defaultRestDuration).toBe(120);
    expect(repo.getData().preferences.defaultRestDuration).toBe(120);
  });

  it('retains in-memory state after a failed write and recovers on retry', async () => {
    const { repo, store } = makeRepository();
    await repo.initialise();

    let shouldFail = true;
    store.onWrite = (key) => {
      if (shouldFail && key !== BACKUP_KEY) {
        throw new Error('simulated disk full');
      }
    };

    await expect(
      repo.update((draft) => {
        draft.preferences.weightUnit = 'lb';
      }),
    ).rejects.toThrow('simulated disk full');

    // In-memory state is not lost.
    expect(repo.getData().preferences.weightUnit).toBe('lb');

    shouldFail = false;
    await repo.update((draft) => {
      draft.preferences.autoStartRestTimer = true;
    });

    const stored = JSON.parse(store.contents(PRIMARY_KEY) ?? '{}') as AppData;
    expect(stored.preferences.weightUnit).toBe('lb');
    expect(stored.preferences.autoStartRestTimer).toBe(true);
  });

  it('rejects a mutation that produces invalid data without persisting', async () => {
    const { repo, store } = makeRepository();
    await repo.initialise();
    const before = store.contents(PRIMARY_KEY);

    await expect(
      repo.update((draft) => {
        // 31 exercises exceeds the per-workout/routine limit of 30.
        draft.routines.push({
          routineId: 'too-big',
          name: 'Too Big',
          exercises: Array.from({ length: 31 }, (_, i) => ({
            exerciseId: `ex-${i}`,
            order: i,
            sets: [{ reps: 10 }],
          })),
          createdAt: FIXED_NOW.toISOString(),
          updatedAt: FIXED_NOW.toISOString(),
        });
      }),
    ).rejects.toThrow(DataValidationError);

    expect(store.contents(PRIMARY_KEY)).toBe(before);
    expect(repo.getData().routines).toHaveLength(0);
  });
});

describe('corruption recovery', () => {
  it('restores from the backup copy when the primary file is corrupt', async () => {
    const { repo: writer, store } = makeRepository();
    await writer.initialise();
    await writer.update((draft) => {
      draft.preferences.defaultRestDuration = 45;
    });
    // Now: primary = v2, backup = v1 (initial document).

    store.seed(PRIMARY_KEY, '{ this is not json !!!');

    const { repo: reader } = makeRepository(store);
    const result = await reader.initialise();

    expect(result.status).toBe('recovered');
    expect(result.message).toBeTruthy();
    // Restored to the last known-good backup (initial document).
    expect(reader.getData().preferences.defaultRestDuration).toBe(120);
    // Primary file was rewritten with valid JSON.
    expect(() => JSON.parse(store.contents(PRIMARY_KEY) ?? '')).not.toThrow();
  });

  it('throws DataCorruptedError and preserves files when both copies are bad', async () => {
    const { store } = makeRepository();
    store.seed(PRIMARY_KEY, 'garbage{{{');
    store.seed(BACKUP_KEY, 'also garbage');

    const { repo } = makeRepository(store);
    await expect(repo.initialise()).rejects.toThrow(DataCorruptedError);

    // Damaged files are preserved, not silently overwritten.
    expect(store.contents(PRIMARY_KEY)).toBe('garbage{{{');
    expect(store.contents(BACKUP_KEY)).toBe('also garbage');
  });
});

describe('import/export', () => {
  it('round-trips data through exportJson/importJson', async () => {
    const { repo: source } = makeRepository();
    await source.initialise();
    await source.update((draft) => {
      draft.workouts.push({
        workoutId: 'w1',
        name: 'Morning Workout',
        startedAt: '2026-11-09T07:00:00.000Z',
        completedAt: '2026-11-09T08:00:00.000Z',
        completedLocalDate: '2026-11-09',
        status: 'completed',
        exercises: [
          {
            exerciseId: 'push-up',
            name: 'Push-Up',
            order: 0,
            sets: [
              {
                setId: 's1',
                type: 'normal',
                reps: 10,
                completed: true,
              },
            ],
          },
        ],
        createdAt: FIXED_NOW.toISOString(),
        updatedAt: FIXED_NOW.toISOString(),
      });
    });

    const exported = source.exportJson();

    const { repo: target } = makeRepository();
    await target.initialise();
    await target.importJson(exported);

    expect(target.getData()).toEqual(source.getData());
  });

  it('rejects invalid JSON imports and preserves current data', async () => {
    const { repo, store } = makeRepository();
    await repo.initialise();
    const before = store.contents(PRIMARY_KEY);

    await expect(repo.importJson('not json at all')).rejects.toThrow(
      ImportValidationError,
    );
    await expect(repo.importJson('{"foo": 1}')).rejects.toThrow(
      InvalidDocumentError,
    );

    expect(store.contents(PRIMARY_KEY)).toBe(before);
    expect(repo.getData().workouts).toHaveLength(0);
  });

  it('rejects imports with a future schema version', async () => {
    const { repo } = makeRepository();
    await repo.initialise();

    const future = validDocumentJson({ schemaVersion: 99 });
    await expect(repo.importJson(future)).rejects.toThrow(
      FutureSchemaVersionError,
    );
    expect(repo.getData().schemaVersion).toBe(2);
  });
});

describe('schema versioning', () => {
  it('migrates an older document before validating it', async () => {
    const { store } = makeRepository();
    // A schemaVersion 0 document predates the current v1 schema. The
    // injected migration stamps it to v1 (stands in for the first real
    // migration that will be registered when the schema evolves).
    const legacy = createInitialDocument(FIXED_NOW) as unknown as Record<
      string,
      unknown
    >;
    legacy.schemaVersion = 0;
    legacy.preferences = {
      weightUnit: 'kg',
      defaultRestDuration: 120,
      // v0 lacked autoStartRestTimer; the migration adds it.
    };
    store.seed(PRIMARY_KEY, JSON.stringify(legacy));

    const migrations = {
      // Chain into the real v1 -> v2 migration registered in MIGRATIONS.
      1: MIGRATIONS[1] as (data: unknown) => unknown,
      0: (data: unknown) => {
        const doc = data as Record<string, unknown>;
        const prefs = doc.preferences as Record<string, unknown>;
        return {
          ...doc,
          schemaVersion: 1,
          preferences: { ...prefs, autoStartRestTimer: false },
        };
      },
    };

    const repo = new DataRepository(store, {
      now: () => FIXED_NOW,
      migrations,
    });
    const result = await repo.initialise();

    expect(result.status).toBe('loaded');
    expect(repo.getData().schemaVersion).toBe(2);
    expect(repo.getData().preferences.autoStartRestTimer).toBe(false);
    // The migrated document was persisted.
    const stored = JSON.parse(store.contents(PRIMARY_KEY) ?? '{}') as AppData;
    expect(stored.schemaVersion).toBe(2);
  });

  it('migrates v1 routine targets into per-set targets', async () => {
    const { store } = makeRepository();
    // A v1 document stores targetSets/targetReps per routine exercise.
    const legacy = createInitialDocument(FIXED_NOW) as unknown as Record<
      string,
      unknown
    >;
    legacy.schemaVersion = 1;
    legacy.routines = [
      {
        routineId: 'routine-1',
        name: 'Push Day',
        exercises: [
          {
            exerciseId: 'push-up',
            order: 0,
            targetSets: 3,
            targetReps: 12,
          },
        ],
        createdAt: FIXED_NOW.toISOString(),
        updatedAt: FIXED_NOW.toISOString(),
      },
    ];
    store.seed(PRIMARY_KEY, JSON.stringify(legacy));

    const repo = new DataRepository(store, { now: () => FIXED_NOW });
    const result = await repo.initialise();

    expect(result.status).toBe('loaded');
    const routine = repo.getData().routines[0];
    expect(routine?.exercises[0]?.sets).toEqual([
      { reps: 12 },
      { reps: 12 },
      { reps: 12 },
    ]);
  });

  it('rejects documents from a newer schema version without touching them', async () => {
    const { store } = makeRepository();
    const futureJson = validDocumentJson({ schemaVersion: 42 });
    store.seed(PRIMARY_KEY, futureJson);

    const { repo } = makeRepository(store);
    await expect(repo.initialise()).rejects.toThrow(FutureSchemaVersionError);
    expect(store.contents(PRIMARY_KEY)).toBe(futureJson);
  });
});

describe('large document performance', () => {
  function bigDocument(): AppData {
    const doc = createInitialDocument(FIXED_NOW);
    const exerciseId = doc.exercises[0]?.exerciseId ?? 'ex-1';
    for (let i = 0; i < 300; i += 1) {
      const day = String((i % 28) + 1).padStart(2, '0');
      const stamp = `2026-01-${day}T10:00:00.000Z`;
      doc.workouts.push({
        workoutId: `perf-${i}`,
        name: `Workout ${i}`,
        startedAt: stamp,
        completedAt: `2026-01-${day}T11:00:00.000Z`,
        completedLocalDate: `2026-01-${day}`,
        status: 'completed',
        exercises: [
          {
            exerciseId,
            name: 'Exercise',
            order: 0,
            sets: [
              {
                setId: `perf-set-${i}`,
                type: 'normal',
                completed: true,
                reps: 5,
                weightKg: 100,
              },
            ],
          },
        ],
        createdAt: stamp,
        updatedAt: stamp,
      });
    }
    return doc;
  }

  it('initialises and updates a 300-workout document promptly', async () => {
    const { store } = makeRepository();
    store.seed(PRIMARY_KEY, JSON.stringify(bigDocument()));
    const { repo } = makeRepository(store);

    const initStart = performance.now();
    await repo.initialise();
    const initMs = performance.now() - initStart;

    const updateStart = performance.now();
    await repo.update((draft) => {
      draft.workouts[0]!.name = 'Renamed';
    });
    const updateMs = performance.now() - updateStart;

    expect(repo.getData().workouts).toHaveLength(300);
    // Loose bounds: this is a smoke check, not a benchmark. A single-user
    // JSON document of this size should validate and write in well under
    // a second on-device; 5s leaves huge headroom for slow CI machines.
    expect(initMs).toBeLessThan(5000);
    expect(updateMs).toBeLessThan(5000);
  });
});
