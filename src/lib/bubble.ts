// How big a bubble has to be to hold what it says.
//
// A bubble is not a box with text dropped in it: the text decides the shape.
// We break the line into a sensible number of lines for its length, measure
// those, and then size the balloon so the text sits inside the ellipse rather
// than inside its bounding box - an ellipse holds about 70% of the width and
// height of the rectangle around it, so a box that merely fits will clip at
// the corners.

export type Measured = { lines: string[]; width: number; height: number };

const LINE_HEIGHT = 1.22;
/** Of the box around an ellipse, how much is safely inside it. */
const ELLIPSE_FILL = 0.72;

let scratch: CanvasRenderingContext2D | null = null;

function measurer(font: string): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;
  scratch ??= document.createElement("canvas").getContext("2d");
  if (scratch) scratch.font = font;
  return scratch;
}

/** Width of a string, measured if we can and estimated if we cannot. */
function widthOf(text: string, fontSize: number, family: string): number {
  const ctx = measurer(`${fontSize}px ${family}`);
  if (ctx) return ctx.measureText(text).width;
  return text.length * fontSize * 0.52; // server-side estimate
}

/**
 * Breaks text into at most `maxLines` lines, each no wider than `maxWidth`,
 * preferring lines of even length so a balloon looks balanced rather than
 * ragged. Explicit newlines in the text are kept.
 */
export function wrap(text: string, fontSize: number, family: string, maxWidth: number, maxLines = 6): string[] {
  const paragraphs = text.split("\n");
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && widthOf(candidate, fontSize, family) > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines.slice(0, maxLines);
}

export const FAMILY = {
  speech: '"Comic Sans MS", "Chalkboard SE", system-ui',
  caption: 'Georgia, "Times New Roman", serif',
  sfx: 'Impact, "Haettenschweiler", system-ui',
} as const;

/**
 * The size a bubble needs to be for its text. `target` is the width we would
 * like the text to wrap at, which for a balloon is a readable 12-ish characters
 * a line rather than one long sentence.
 */
export function measure(
  text: string,
  kind: keyof typeof FAMILY,
  fontSize: number,
  padding = kind === "sfx" ? 8 : 20,
): Measured {
  const family = FAMILY[kind];
  const body = text.trim() || " ";
  // Aim for roughly square text: a balloon reads better than a ribbon.
  const total = widthOf(body.replace(/\n/g, " "), fontSize, family);
  const target = Math.max(fontSize * 4, Math.sqrt(total * fontSize * LINE_HEIGHT * 1.9));
  const lines = wrap(body, fontSize, family, target);
  const textWidth = Math.max(...lines.map((l) => widthOf(l, fontSize, family)), fontSize);
  const textHeight = lines.length * fontSize * LINE_HEIGHT;

  if (kind === "speech") {
    return {
      lines,
      width: textWidth / ELLIPSE_FILL + padding,
      height: textHeight / ELLIPSE_FILL + padding,
    };
  }
  return { lines, width: textWidth + padding * 2, height: textHeight + padding * 2 };
}

/** A bubble's size: what the reader set, or what its text needs. */
export function sizeOf(bubble: {
  kind: keyof typeof FAMILY;
  text: string;
  fontSize: number;
  width?: number;
  height?: number;
}): { width: number; height: number } {
  if (bubble.width !== undefined && bubble.height !== undefined) {
    return { width: bubble.width, height: bubble.height };
  }
  const m = measure(bubble.text, bubble.kind, bubble.fontSize);
  return { width: bubble.width ?? m.width, height: bubble.height ?? m.height };
}

/** A bubble's box in page coordinates. `x`/`y` are its centre. */
export function boxOf(bubble: Parameters<typeof sizeOf>[0] & { x: number; y: number }) {
  const { width, height } = sizeOf(bubble);
  return { left: bubble.x - width / 2, top: bubble.y - height / 2, width, height };
}

// ─── The balloon outline ────────────────────────────────────

type Ctx = {
  beginPath(): void;
  closePath(): void;
  ellipse(x: number, y: number, rx: number, ry: number, rotation: number, start: number, end: number, anti?: boolean): void;
  quadraticCurveTo(cx: number, cy: number, x: number, y: number): void;
};

/**
 * Traces a balloon and its tail as **one** closed path, in bubble-local
 * coordinates with the centre at 0,0.
 *
 * One path matters: drawing the tail and the balloon separately leaves the
 * balloon's own outline painted across the base of the tail, and the tail then
 * reads as a triangle stuck onto a circle rather than part of the same shape.
 * Here the outline goes round the ellipse, out along one side of the tail to
 * the tip, and back along the other, so there is nothing to seam.
 *
 * The two sides of the tail are curves bending the same way, which is what
 * makes it look drawn rather than folded: a tail with straight edges is a
 * wedge, and no letterer draws a wedge. How far it bends grows with how far
 * the tail reaches, and the direction follows where it is pointing, so a tail
 * to the left hooks the opposite way to one on the right.
 */
export function balloonPath(ctx: Ctx, rx: number, ry: number, tail?: { x: number; y: number }): void {
  const reach = tail ? Math.hypot(tail.x, tail.y) : 0;
  // A tip dragged inside the balloon, or a balloon grown out over its own tip,
  // has no tail to draw: anything else would be a spur on the outline.
  if (!tail || reach < Math.min(rx, ry) * 1.08) {
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.closePath();
    return;
  }

  const angle = Math.atan2(tail.y, tail.x);
  // A long tail leaves the balloon from a narrower base, as a drawn one does.
  const spread = Math.max(0.17, 0.42 - reach / Math.max(rx, ry) / 14);

  const at = (a: number) => ({ x: rx * Math.cos(a), y: ry * Math.sin(a) });
  const from = at(angle + spread);
  const to = at(angle - spread);

  // Perpendicular to the line out to the tip; both edges lean the same way.
  const ux = tail.x / (reach || 1);
  const uy = tail.y / (reach || 1);
  const lean = Math.min(reach * 0.16, Math.max(rx, ry) * 0.9);
  const px = -uy * lean;
  const py = ux * lean;

  const bend = (ax: number, ay: number, bx: number, by: number) => ({
    x: (ax + bx) / 2 + px,
    y: (ay + by) / 2 + py,
  });

  ctx.beginPath();
  // The long way round, leaving the gap the tail grows out of.
  ctx.ellipse(0, 0, rx, ry, 0, angle + spread, angle - spread + Math.PI * 2);
  const out = bend(to.x, to.y, tail.x, tail.y);
  ctx.quadraticCurveTo(out.x, out.y, tail.x, tail.y);
  const back = bend(tail.x, tail.y, from.x, from.y);
  ctx.quadraticCurveTo(back.x, back.y, from.x, from.y);
  ctx.closePath();
}
