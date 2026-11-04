// A PNG sheet must reach the edit endpoint labelled as a PNG.
import { readFileSync } from "node:fs";
import { attach, editImage } from "../src/lib/meta/client";

async function main() {
  const png = `data:image/png;base64,${readFileSync("/tmp/t.png").toString("base64")}`;
  const jpg = `data:image/jpeg;base64,${readFileSync("/tmp/t.jpg").toString("base64")}`;
  for (const [label, url] of [["png", png], ["jpeg", jpg]] as const) {
    const input = attach(url, "reference-1");
    try {
      const [out] = await editImage({ prompt: "Draw this person waving.", images: [input] });
      console.log(`${label.padEnd(5)} as ${String(input.type).padEnd(11)} (${input.name}) -> ok, ${(out.length / 1024).toFixed(0)}kB`);
    } catch (e) {
      console.log(`${label.padEnd(5)} as ${String(input.type).padEnd(11)} -> ${e instanceof Error ? e.message.slice(0, 160) : e}`);
    }
  }
}
main();
