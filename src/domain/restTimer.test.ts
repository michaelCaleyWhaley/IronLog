import { describe, expect, it } from 'vitest';

import {
  clampDuration,
  formatRemaining,
  initialRestTimerState,
  isTimerActive,
  pauseTimer,
  remainingMs,
  resetTimer,
  resumeTimer,
  shouldAutoStartRest,
  startTimer,
  tickTimer,
} from './restTimer';
import { LIMITS } from './limits';
import { createInitialDocument } from './initialDocument';

describe('restTimer', () => {
  it('starts idle with the configured duration', () => {
    const state = initialRestTimerState(90);
    expect(state.status).toBe('idle');
    expect(state.durationSeconds).toBe(90);
    expect(remainingMs(state, 0)).toBe(90_000);
    expect(isTimerActive(state)).toBe(false);
  });

  it('transitions start -> running -> finished via tick', () => {
    const t0 = 1_000_000;
    let state = startTimer(initialRestTimerState(60), 60, t0);
    expect(state.status).toBe('running');
    expect(state.endsAt).toBe(t0 + 60_000);
    expect(isTimerActive(state)).toBe(true);

    // Before the end it stays running.
    expect(tickTimer(state, t0 + 30_000)).toBe(state);
    expect(remainingMs(state, t0 + 30_000)).toBe(30_000);

    // At/past the end it finishes with zero remaining.
    const done = tickTimer(state, t0 + 60_000);
    expect(done.status).toBe('finished');
    expect(done.endsAt).toBeUndefined();
    expect(remainingMs(done, t0 + 90_000)).toBe(0);
    expect(isTimerActive(done)).toBe(false);
  });

  it('pauses with frozen remaining and resumes from it', () => {
    const t0 = 5_000;
    let state = startTimer(initialRestTimerState(60), 60, t0);
    state = pauseTimer(state, t0 + 20_000);
    expect(state.status).toBe('paused');
    expect(state.endsAt).toBeUndefined();
    expect(remainingMs(state, t0 + 999_000)).toBe(40_000);

    state = resumeTimer(state, t0 + 25_000);
    expect(state.status).toBe('running');
    expect(state.endsAt).toBe(t0 + 25_000 + 40_000);
    expect(remainingMs(state, t0 + 30_000)).toBe(35_000);
  });

  it('pause/resume are no-ops in wrong states', () => {
    const idle = initialRestTimerState(30);
    expect(pauseTimer(idle, 0)).toBe(idle);
    expect(resumeTimer(idle, 0)).toBe(idle);

    const running = startTimer(idle, 30, 0);
    expect(resumeTimer(running, 1000)).toBe(running);
  });

  it('resuming a fully elapsed pause finishes immediately', () => {
    let state = startTimer(initialRestTimerState(10), 10, 0);
    state = pauseTimer(state, 12_000); // remaining would be negative -> clamped 0
    expect(state.status).toBe('paused');
    expect(remainingMs(state, 0)).toBe(0);
    state = resumeTimer(state, 20_000);
    expect(state.status).toBe('finished');
  });

  it('reset returns to idle keeping duration', () => {
    let state = startTimer(initialRestTimerState(45), 45, 0);
    state = pauseTimer(state, 10_000);
    state = resetTimer(state);
    expect(state.status).toBe('idle');
    expect(state.durationSeconds).toBe(45);
    expect(remainingMs(state, 0)).toBe(45_000);
  });

  it('clamps durations to the allowed range', () => {
    expect(clampDuration(-5)).toBe(LIMITS.minRestDurationSeconds);
    expect(clampDuration(999_999)).toBe(LIMITS.maxRestDurationSeconds);
    expect(clampDuration(62.6)).toBe(63);
    expect(clampDuration(Number.NaN)).toBe(LIMITS.minRestDurationSeconds);

    const state = startTimer(initialRestTimerState(30), 999_999, 0);
    expect(state.durationSeconds).toBe(LIMITS.maxRestDurationSeconds);
  });

  it('formats remaining time as m:ss and h:mm:ss', () => {
    expect(formatRemaining(0)).toBe('0:00');
    expect(formatRemaining(65_000)).toBe('1:05');
    expect(formatRemaining(3_725_000)).toBe('1:02:05');
    expect(formatRemaining(999)).toBe('0:01');
  });

  it('auto-start preference gates rest-timer auto start', () => {
    const doc = createInitialDocument();
    expect(shouldAutoStartRest(doc.preferences)).toBe(false);
    doc.preferences.autoStartRestTimer = true;
    expect(shouldAutoStartRest(doc.preferences)).toBe(true);
  });
});
