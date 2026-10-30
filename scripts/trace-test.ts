import { readFileSync } from "node:fs";
import { decodeMaskToSVGPath } from "@meta-sam/parser";
import { maskToPolygon, pathToPoints, snapToBox } from "../src/lib/trace";
import { masksOf, segment } from "../src/lib/meta/sam";

async function main() {
  const image = `data:image/webp;base64,${readFileSync(".spike/page.webp").toString("base64")}`;
  for (const concept of ["comic panel", "speech bubble"]) {
    const r = await segment({ image, concept });
    console.log(`\n${concept}:`);
    for (const m of masksOf(r)) {
      const path = decodeMaskToSVGPath(m.mask);
      const raw = pathToPoints(path).length;
      const poly = maskToPolygon(path, m.bounds, m.mask);
      const snapped = snapToBox(poly);
      console.log(
        `  ${raw} -> ${poly.length} -> ${snapped.length}: ${snapped.slice(0, 4).map((p) => `(${p.x.toFixed(0)},${p.y.toFixed(0)})`).join(" ")}${snapped.length > 4 ? " ..." : ""}`,
      );
    }
  }
}
main();
