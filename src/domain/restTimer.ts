import { LIMITS } from './limits';
import type { Preferences } from './types';

export type RestTimerStatus = 'idle' | 'running' | 'paused' | 'finished';

export interface RestTimerState {
  status: RestTimerStatus;
  /** Configured rest length in seconds. */
  durationSeconds: number;
  /** Epoch ms when the current run ends (only while running). */
  endsAt?: number;
  /** Frozen remaining time in ms (paused/finished). */
  remainingMs?: number;
}

export function initialRestTimerState(durationSeconds: number): RestTimerState {
  return {
    status: 'idle',
    durationSeconds: clampDuration(durationSeconds),
  };
}

export function clampDuration(seconds: number): number {
  if (!Number.isFinite(seconds)) {
    return LIMITS.minRestDurationSeconds;
  }
  return Math.min(
    Math.max(Math.round(seconds), LIMITS.minRestDurationSeconds),
    LIMITS.maxRestDurationSeconds,
  );
}

/** Remaining time in ms for display; computes live value while running. */
export function remainingMs(state: RestTimerState, now: number): number {
  if (state.status === 'running' && state.endsAt !== undefined) {
    return Math.max(0, state.endsAt - now);
  }
  if (state.remainingMs !== undefined) {
    return state.remainingMs;
  }
  return state.durationSeconds * 1000;
}

export function isTimerActive(state: RestTimerState): boolean {
  return state.status === 'running' || state.status === 'paused';
}

export function startTimer(
  state: RestTimerState,
  durationSeconds: number,
  now: number,
): RestTimerState {
  const duration = clampDuration(durationSeconds);
  return {
    status: 'running',
    durationSeconds: duration,
    endsAt: now + duration * 1000,
    remainingMs: undefined,
  };
}

/** (Re)starts the timer for `durationSeconds` from now. */
export function restartTimer(
  state: RestTimerState,
  durationSeconds: number,
  now: number,
): RestTimerState {
  return startTimer(state, durationSeconds, now);
}

export function pauseTimer(state: RestTimerState, now: number): RestTimerState {
  if (state.status !== 'running' || state.endsAt === undefined) {
    return state;
  }
  return {
    ...state,
    status: 'paused',
    endsAt: undefined,
    remainingMs: Math.max(0, state.endsAt - now),
  };
}

export function resumeTimer(
  state: RestTimerState,
  now: number,
): RestTimerState {
  if (state.status !== 'paused') {
    return state;
  }
  const remaining = state.remainingMs ?? 0;
  if (remaining <= 0) {
    return { ...state, status: 'finished', endsAt: undefined };
  }
  return {
    ...state,
    status: 'running',
    endsAt: now + remaining,
    remainingMs: undefined,
  };
}

/** Returns to idle, keeping the configured duration. */
export function resetTimer(state: RestTimerState): RestTimerState {
  return {
    status: 'idle',
    durationSeconds: state.durationSeconds,
  };
}

/** Advances the timer; flips running -> finished when time elapses. */
export function tickTimer(state: RestTimerState, now: number): RestTimerState {
  if (state.status !== 'running' || state.endsAt === undefined) {
    return state;
  }
  if (now < state.endsAt) {
    return state;
  }
  return {
    ...state,
    status: 'finished',
    endsAt: undefined,
    remainingMs: 0,
  };
}

/** Whether completing a set should (re)start the rest timer. */
export function shouldAutoStartRest(preferences: Preferences): boolean {
  return preferences.autoStartRestTimer;
}

/** Formats remaining milliseconds as m:ss (or h:mm:ss past an hour). */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${minutes}:${ss}`;
}
