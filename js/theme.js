/**
 * Theme manager
 *
 * Applies a theme by setting data-theme on <html>.
 * CSS handles the variable overrides per theme name.
 */

export const THEMES = ['forest', 'midnight', 'ember', 'slate', 'crimson'];

export function applyTheme(name) {
  document.documentElement.dataset.theme = THEMES.includes(name) ? name : 'forest';
}
