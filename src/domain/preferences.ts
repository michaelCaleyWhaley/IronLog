import type { AppData, Preferences } from './types';

export type PreferencesPatch = Partial<Preferences>;

/** Applies a partial preferences update to the document draft. */
export function updatePreferences(
  draft: AppData,
  patch: PreferencesPatch,
): Preferences {
  draft.preferences = { ...draft.preferences, ...patch };
  return draft.preferences;
}
