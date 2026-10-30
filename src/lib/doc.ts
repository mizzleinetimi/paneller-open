// What a comic page is, as far as this editor is concerned.
//
// A panel is a polygon, not a rectangle, because SAM returns masks for slanted
// and irregular panels and we want those to drop straight in. A rectangular
// panel is simply a four-point polygon.

export type Point = { x: number; y: number };

export type Panel = {
  id: string;
  /** Closed polygon in page coordinates, clockwise from the top left. */
  shape: Point[];
  /** Art drawn inside the polygon, which clips it. */
  art?: { src: string; x: number; y: number; width: number; height: number };
  /** The line of script this panel came from, if any. */
  script?: string;
};

export type BubbleKind = "speech" | "caption" | "sfx";

export type Bubble = {
  id: string;
  kind: BubbleKind;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  /** Where the tail points, for speech. Absent means no tail. */
  tail?: Point;
  fontSize: number;
};

export type Page = {
  id: string;
  width: number;
  height: number;
  background: string;
  /** The page as it arrived, drawn under everything. Set when a page is read in. */
  art?: string;
  panels: Panel[];
  bubbles: Bubble[];
};

export type Doc = { title: string; pages: Page[] };

export type Selection = { kind: "panel" | "bubble"; id: string } | null;

let counter = 0;
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(counter++).toString(36)}`;

export const rectShape = (x: number, y: number, w: number, h: number): Point[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

/** The axis-aligned box a polygon sits in. */
export function bounds(shape: Point[]): { x: number; y: number; width: number; height: number } {
  const xs = shape.map((p) => p.x);
  const ys = shape.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Konva wants a flat [x,y,x,y,...] list. */
export const flatten = (shape: Point[]): number[] => shape.flatMap((p) => [p.x, p.y]);

export function emptyPage(width = 1280, height = 1920): Page {
  const m = 40; // margin
  const g = 24; // gutter
  const colW = (width - m * 2 - g) / 2;
  const rowH = (height - m * 2 - g) / 2;
  const at = (col: number, row: number) =>
    rectShape(m + col * (colW + g), m + row * (rowH + g), colW, rowH);
  return {
    id: newId("page"),
    width,
    height,
    background: "#ffffff",
    panels: [at(0, 0), at(1, 0), at(0, 1), at(1, 1)].map((shape) => ({ id: newId("panel"), shape })),
    bubbles: [],
  };
}

export const emptyDoc = (): Doc => ({ title: "Untitled comic", pages: [emptyPage()] });

export function newBubble(kind: BubbleKind, x: number, y: number): Bubble {
  const size = kind === "sfx" ? 72 : 28;
  return {
    id: newId("bubble"),
    kind,
    x,
    y,
    width: kind === "sfx" ? 360 : 260,
    height: kind === "sfx" ? 110 : 140,
    text: kind === "sfx" ? "SKRRRT!" : kind === "caption" ? "Later that evening..." : "Say something.",
    fontSize: size,
    ...(kind === "speech" ? { tail: { x: x + 60, y: y + 190 } } : {}),
  };
}
