export type SurfaceTheme = "light" | "dark";

/**
 * Declares the dominant surface under the fixed header. The header (and the
 * page canvas colour used for overscroll) read `data-surface` on <html>, so
 * any section can flip it without React re-renders or prop drilling.
 */
export function setSurfaceTheme(theme: SurfaceTheme): void {
  const root = document.documentElement;
  if (root.dataset.surface !== theme) root.dataset.surface = theme;
}
