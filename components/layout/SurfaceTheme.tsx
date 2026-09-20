"use client";

import { useEffect } from "react";
import { setSurfaceTheme, type SurfaceTheme as Theme } from "@/lib/surfaceTheme";

/** Declares the page's dominant surface for the shared header. Renders nothing. */
export function SurfaceTheme({ theme }: { theme: Theme }) {
  useEffect(() => setSurfaceTheme(theme), [theme]);
  return null;
}
