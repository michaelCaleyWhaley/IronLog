import { describe, expect, it } from 'vitest';

import Colors from './Colors';

describe('Colors', () => {
  it('defines light and dark themes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const theme = Colors[scheme];
      expect(theme.text).toBeTruthy();
      expect(theme.background).toBeTruthy();
      expect(theme.tint).toBeTruthy();
      expect(theme.tabIconDefault).toBeTruthy();
      expect(theme.tabIconSelected).toBeTruthy();
    }
  });
});
