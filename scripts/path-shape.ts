import { readFileSync } from "node:fs";
import { decodeMaskToSVGPath } from "@meta-sam/parser";
import { masksOf, segment } from "../src/lib/meta/sam";

async function main() {
  const image = `data:image/webp;base64,${readFileSync(".spike/page.webp").toString("base64")}`;
  const r = await segment({ image, concept: "comic panel" });
  const masks = masksOf(r);
  const path = decodeMaskToSVGPath(masks[0].mask);
  console.log("length:", path.length);
  console.log("commands used:", [...new Set(path.match(/[A-Za-z]/g) ?? [])].join(" "));
  console.log("head:", path.slice(0, 220));
  console.log("tail:", path.slice(-120));
  console.log("subpaths (M count):", (path.match(/M/g) ?? []).length);
  console.log("bounds record:", masks[0].bounds);
  console.log("mask dims:", masks[0].mask.width, "x", masks[0].mask.height);
}
main();
