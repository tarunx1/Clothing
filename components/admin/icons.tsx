/** Tiny stroke icon set for the admin; decorative only (aria-hidden). */
const paths = {
  dashboard: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
  products: "M4 7l8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4M12 11v10",
  collections: "M3 5h18M3 12h18M3 19h18",
  inventory: "M4 4h16v4H4zM5 8v12h14V8M10 12h4",
  orders: "M6 3h12l2 4v14H4V7zM4 7h16M9 11h6",
  content: "M4 4h16v16H4zM4 9h16M9 9v11",
  settings: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM3 12h2M19 12h2M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4",
  menu: "M3 6h18M3 12h18M3 18h18",
  close: "M5 5l14 14M19 5L5 19",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-5-5",
  up: "M12 19V5M5 12l7-7 7 7",
  down: "M12 5v14M19 12l-7 7-7-7",
  grip: "M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  back: "M15 5l-7 7 7 7",
  upload: "M12 16V4M6 10l6-6 6 6M4 20h16",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  plus: "M12 5v14M5 12h14",
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={paths[name]} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
