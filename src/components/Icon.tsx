import type { CSSProperties } from "react";

const paths: Record<string, string> = {
  inventory: "M3 7h18v14H3Z M2 3h20v4H2Z M9 11h6 M9 15h6 M9 18h3",
  home: "m3 10 9-7 9 7v11h-7v-7h-4v7H3Z",
  book: "M4 3h5v18H4z M12 3h4v18h-4z m6 1 3-1 4 17-3 1z",
  compass: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z m4-16-2 8-8 4 4-8Z",
  calendar: "M3 6h18v15H3z M3 10h18 M7 3v5 M17 3v5",
  network:
    "M9 4a3 3 0 1 0 6 0 3 3 0 0 0-6 0 M2 18a3 3 0 1 0 6 0 3 3 0 0 0-6 0 m14 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0 M10 7l-4 8 m8-8 4 8 M8 18h8",
  chart: "M4 20V12 M10 20V4 M16 20V8 M22 20H1",
  file: "M5 2h9l5 5v15H5z M14 2v6h5 M8 12h8 M8 16h8",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z M9 3l1-2h4l1 2 3 2 2 1v4l2 1v3l-2 1-1 3-3 1-1 2h-4l-1-2-3-1-1-3-2-1v-3l2-1V6l2-1Z",
  gem: "m3 8 4-5h10l4 5-9 13Z M3 8h18 M7 3l5 18 5-18",
  arrow: "M4 12h16 m-6-6 6 6-6 6",
  download: "M12 3v12 m-5-5 5 5 5-5 M4 16v5h16v-5",
  upload: "M12 16V3 m-5 5 5-5 5 5 M4 16v5h16v-5",
  check: "m5 12 4 4 10-11",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 10v7 M12 6v1",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M9 8a3 3 0 1 1 5 2l-2 2v2 M12 17v1",
  pin: "M12 22s8-9 8-14a8 8 0 0 0-16 0c0 5 8 14 8 14Z M9 8a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  search: "M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z m6-2 6 6",
  bell: "M5 17h14l-2-4V8a5 5 0 0 0-10 0v5Z M10 21h4",
  edit: "m4 16-1 5 5-1L21 7l-5-5Z M13 5l5 5",
  music:
    "M9 18V4l12-2v14 M9 7l12-2 M3 19a3 3 0 1 0 6 0 3 3 0 0 0-6 0 m12-2a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  people:
    "M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M1 22v-3a7 7 0 0 1 14 0v3 M17 4a4 4 0 0 1 0 8 M18 15a6 6 0 0 1 5 7",
  reset: "M3 10a9 9 0 1 1 2 9 M3 3v7h7",
  close: "m5 5 14 14 M19 5 5 19",
  plus: "M12 3v18 M3 12h18",
  trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
};

export default function Icon({
  name,
  size = 20,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name] ?? paths.info} />
    </svg>
  );
}
