// Does a second page keep the first page's characters? Writes both to .spike/.
import { mkdirSync, writeFileSync } from "node:fs";
import { STYLES, drawPlan, planNextPage, planStory } from "../src/lib/compose";

async function main() {
  mkdirSync(".spike", { recursive: true });
  const idea = "a tailor in Aba argues with a customer about a late order";

  let t = Date.now();
  const { bible, plan } = await planStory(idea, 3);
  console.log(`bible in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  console.log(`  "${bible.title}" - ${bible.setting}`);
  for (const c of bible.cast) console.log(`  ${c.who}: ${c.look}`);

  t = Date.now();
  const page1 = await drawPlan(plan, STYLES.classic);
  writeFileSync(".spike/p1.webp", Buffer.from(page1.split(",")[1], "base64"));
  console.log(`page 1 drawn in ${((Date.now() - t) / 1000).toFixed(1)}s`);

  t = Date.now();
  const next = await planNextPage(bible, [plan], "the customer tries the suit on and it fits perfectly", 3);
  const page2 = await drawPlan(next, STYLES.classic, { image: page1, cast: bible.cast.map((c) => c.look) });
  writeFileSync(".spike/p2.webp", Buffer.from(page2.split(",")[1], "base64"));
  console.log(`page 2 drawn in ${((Date.now() - t) / 1000).toFixed(1)}s`);
  console.log("\n", next.panels.map((p) => `${p.speaker ?? "-"}: ${p.speech ?? ""}`).join("\n "));
}
main();
