// Turning a SAM mask into a polygon you can actually edit.
//
// `decodeMaskToSVGPath` traces the mask one pixel step at a time: a plain
// rectangular panel comes back as a few thousand points of staircase. We parse
// those points, move them from mask-local into page coordinates, and then drop
// the ones that sit on a line anyone would have drawn straight.

import { type Point, bounds as boundsOf, rectShape } from "./doc";

/** Reads the M/L/Z path the mask decoder emits. Only the first subpath is used. */
export function pathToPoints(path: string): Point[] {
  const points: Point[] = [];
  const token = /([MLZ])([-\d.]+)?\s*([-\d.]+)?/gi;
  for (let m = token.exec(path); m; m = token.exec(path)) {
    if (m[1].toUpperCase() === "Z") break;
    if (m[2] === undefined || m[3] === undefined) continue;
    points.push({ x: Number(m[2]), y: Number(m[3]) });
  }
  return points;
}

const distanceToLine = (p: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / length;
};

/** Ramer-Douglas-Peucker: keeps the corners, drops everything on a straight run. */
export function simplify(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  let worst = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i++) {
    const d = distanceToLine(points[i], first, last);
    if (d > worst) {
      worst = d;
      index = i;
    }
  }
  if (worst <= epsilon) return [first, last];
  const left = simplify(points.slice(0, index + 1), epsilon);
  const right = simplify(points.slice(index), epsilon);
  return [...left.slice(0, -1), ...right];
}

/**
 * A mask's outline as a page-coordinate polygon. `epsilon` is in pixels; about
 * 0.4% of the mask's longest side keeps real corners and loses the staircase.
 */
export function maskToPolygon(
  path: string,
  bounds: { left: number; top: number },
  size: { width: number; height: number },
): Point[] {
  const traced = pathToPoints(path);
  if (traced.length < 3) return traced;
  const epsilon = Math.max(2, 0.004 * Math.max(size.width, size.height));
  const simplified = simplify(traced, epsilon);
  // The trace starts and ends on the same point; keep one of them.
  const closed =
    simplified.length > 2 &&
    simplified[0].x === simplified[simplified.length - 1].x &&
    simplified[0].y === simplified[simplified.length - 1].y
      ? simplified.slice(0, -1)
      : simplified;
  return closed.map((p) => ({ x: p.x + bounds.left, y: p.y + bounds.top }));
}

/** Twice the signed area; sign tells winding, which we don't care about here. */
function polygonArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * Most comic panels are rectangles, and a rectangle traced from a mask comes
 * back as a dozen points wobbling along the border ink. If a polygon fills
 * nearly all of its own box, it was a rectangle and we say so: four corners
 * are far easier to drag than fourteen.
 */
export function snapToBox(points: Point[], fill = 0.93): Point[] {
  if (points.length < 4) return points;
  const box = boundsOf(points);
  const boxArea = box.width * box.height;
  if (boxArea <= 0) return points;
  if (polygonArea(points) / boxArea < fill) return points;
  return rectShape(box.x, box.y, box.width, box.height);
}
