"use client";
import { useEffect } from "react";

const dirtyForms = new Set<symbol>();
const unload = (event: BeforeUnloadEvent) => event.preventDefault();
const navigate = (event: MouseEvent) => {
  if (!(event.target instanceof Element) || !event.target.closest("a[href]")) return;
  if (!window.confirm("Discard unsaved settings changes?")) { event.preventDefault(); event.stopPropagation(); }
};
/** One prompt even when more than one independently saved section has edits. */
export function useUnsavedSettings(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const id = Symbol(); dirtyForms.add(id);
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      dirtyForms.delete(id);
      if (!dirtyForms.size) { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", navigate, true); }
    };
  }, [dirty]);
}
