"use client";

import React from "react";
import { useTheme } from "./ThemeProvider";

/**
 * Editorial theme toggle for the header.
 * Displays a sleek Moon (in light mode) to switch to dark,
 * and a Sun (in dark mode) to switch to light.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="group relative flex h-7 w-7 items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95 focus-visible:outline-1 focus-visible:outline-current"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        /* Sun Icon for Light Mode activation */
        <svg
          className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-45"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="m4.93 4.93 1.41 1.41" />
          <path d="m17.66 17.66 1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="m6.34 17.66-1.41 1.41" />
          <path d="m19.07 4.93-1.41 1.41" />
        </svg>
      ) : (
        /* Moon Icon for Dark Mode activation */
        <svg
          className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-rotate-12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      )}
      <span className="sr-only">{isDark ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );
}
