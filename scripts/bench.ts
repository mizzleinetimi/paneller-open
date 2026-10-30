// Runs detection over the corpus and compares it with what is drawn.
// Run: pnpm bench
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { PAGES } from "../bench/pages";
import { detectPage } from "../src/lib/detect";

type Row = { id: string; kind: string; found: number; truth: number };

const pad = (s: string | number, n: number) => String(s).padEnd(n);

async function main() {
  mkdirSync("bench/out", { recursive: true });
  const rows: Row[] = [];
  const lines: string[] = [];

  for (const page of PAGES) {
    const image = `data:image/webp;base64,${readFileSync(`bench/pages/${page.id}.webp`).toString("base64")}`;
    const t = Date.now();
    const found = await detectPage(image);
    const seconds = ((Date.now() - t) / 1000).toFixed(1);

    const counts = {
      panels: found.counts.panels,
      speech: found.counts.speech,
      sfx: found.counts.sfx,
      caption: found.counts.caption,
    };
    for (const kind of ["panels", "speech", "sfx", "caption"] as const) {
      rows.push({ id: page.id, kind, found: counts[kind], truth: page.truth[kind] });
    }
    const cell = (k: keyof typeof counts) =>
      `${counts[k]}/${page.truth[k]}${counts[k] === page.truth[k] ? " " : "*"}`;
    const line = `${pad(page.id, 14)} panels ${pad(cell("panels"), 7)} speech ${pad(cell("speech"), 6)} sfx ${pad(cell("sfx"), 6)} caption ${pad(cell("caption"), 6)} ${seconds}s`;
    console.log(line);
    lines.push(line);
    writeFileSync(`bench/out/${page.id}.json`, JSON.stringify({ counts, truth: page.truth, panels: found.panels, bubbles: found.bubbles }, null, 2));
  }

  console.log("\nper concept, over the whole corpus:");
  for (const kind of ["panels", "speech", "sfx", "caption"] as const) {
    const mine = rows.filter((r) => r.kind === kind);
    const found = mine.reduce((n, r) => n + r.found, 0);
    const truth = mine.reduce((n, r) => n + r.truth, 0);
    const exact = mine.filter((r) => r.found === r.truth).length;
    const summary = `${pad(kind, 8)} ${found}/${truth} found  exact on ${exact}/${mine.length} pages`;
    console.log("  " + summary);
    lines.push(`TOTAL ${summary}`);
  }
  writeFileSync("bench/out/summary.txt", lines.join("\n") + "\n");
}
main();
