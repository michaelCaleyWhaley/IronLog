import * as Haptics from 'expo-haptics';
import { useEffect, useState, useSyncExternalStore } from 'react';

import type { RestTimerState } from '../domain/restTimer';
import {
  clampDuration,
  formatRemaining,
  initialRestTimerState,
  isTimerActive,
  pauseTimer,
  remainingMs,
  resetTimer,
  restartTimer,
  resumeTimer,
  startTimer,
  tickTimer,
} from '../domain/restTimer';

/**
 * In-memory rest timer. Per the plan it does not need to survive an app
 * restart; state lives for the JS session so it persists across navigation.
 */

let state: RestTimerState = initialRestTimerState(120);
const listeners = new Set<() => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function fireHaptic(fn: () => Promise<void>): void {
  fn().catch(() => {
    // Haptics unsupported or failed — non-fatal.
  });
}

function tick(): void {
  const now = Date.now();
  const next = tickTimer(state, now);
  if (next !== state) {
    state = next;
    if (state.status === 'finished') {
      fireHaptic(() =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      );
    }
    emit();
  }
  if (!isTimerActive(state)) {
    stopTicker();
  }
}

function ensureTicker(): void {
  if (ticker === null) {
    ticker = setInterval(tick, 250);
  }
}

function stopTicker(): void {
  if (ticker !== null) {
    clearInterval(ticker);
    ticker = null;
  }
}

function apply(next: RestTimerState): void {
  state = next;
  emit();
  if (isTimerActive(state)) {
    ensureTicker();
  } else {
    stopTicker();
  }
}

export function getRestTimerState(): RestTimerState {
  return state;
}

export function subscribeRestTimer(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function restTimerStart(durationSeconds?: number): void {
  const now = Date.now();
  const duration = durationSeconds ?? state.durationSeconds;
  apply(startTimer(state, duration, now));
  fireHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Restarts the timer at the configured default duration (auto-start). */
export function restTimerAutoStart(defaultDurationSeconds: number): void {
  apply(restartTimer(state, clampDuration(defaultDurationSeconds), Date.now()));
}

export function restTimerPause(): void {
  apply(pauseTimer(state, Date.now()));
}

export function restTimerResume(): void {
  apply(resumeTimer(state, Date.now()));
}

export function restTimerReset(): void {
  apply(resetTimer(state));
}

export function restTimerAdjustDuration(deltaSeconds: number): void {
  const durationSeconds = clampDuration(state.durationSeconds + deltaSeconds);
  apply({ ...state, durationSeconds });
}

/** Aligns the configured duration with the user's preference (when idle). */
export function restTimerSyncPreference(defaultDurationSeconds: number): void {
  if (state.status === 'idle') {
    apply({
      ...state,
      durationSeconds: clampDuration(defaultDurationSeconds),
    });
  }
}

export interface RestTimerApi {
  state: RestTimerState;
  remainingMs: number;
  display: string;
  start: (durationSeconds?: number) => void;
  autoStart: (defaultDurationSeconds: number) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  adjustDuration: (deltaSeconds: number) => void;
}

export function useRestTimer(): RestTimerApi {
  const timerState = useSyncExternalStore(
    subscribeRestTimer,
    getRestTimerState,
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const ticker = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(ticker);
  }, []);
  const remaining = remainingMs(timerState, nowMs);
  return {
    state: timerState,
    remainingMs: remaining,
    display: formatRemaining(remaining),
    start: restTimerStart,
    autoStart: restTimerAutoStart,
    pause: restTimerPause,
    resume: restTimerResume,
    reset: restTimerReset,
    adjustDuration: restTimerAdjustDuration,
  };
}
