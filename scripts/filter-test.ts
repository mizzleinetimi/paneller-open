// Does a refused edit fall back to drawing from text, and do errors read well?
import { readFileSync } from "node:fs";
import { readable } from "../src/lib/errors";
import { STYLES, type PagePlan, drawPlan } from "../src/lib/compose";
import { ContentFiltered } from "../src/lib/meta/client";

async function main() {
  console.log("messages:");
  for (const e of [
    new ContentFiltered("Meta API /images/edits"),
    new Error('Meta API /images/edits -> 400: {"error":{"code":"content_policy_violation","message":"filtered"}}'),
    new Error("Meta API /chat/completions could not be reached: fetch failed"),
    new Error("Muse Spark ran out of tokens while reasoning. Raise maxTokens."),
  ]) {
    console.log(`  ${readable(e, "page")}`);
  }

  // A real page, drawn against a reference, to confirm the happy path still works.
  const plan: PagePlan = {
    setting: "A roadside stall in Aba at dawn",
    layout: "a wide panel across the top and two beneath it",
    panels: [
      { description: "A woman frying akara at an oil drum stove.", size: "wide" as const },
      { description: "A schoolboy counting coins in his palm.", size: "small" as const },
      { description: "The woman handing over a paper of akara.", size: "small" as const },
    ],
  };
  const ref = `data:image/webp;base64,${readFileSync(".spike/pg-1.webp").toString("base64")}`;
  const out = await drawPlan(plan, STYLES.classic, { images: [ref], cast: ["woman in a yellow headwrap"] });
  console.log(`\ndrew ${(out.image.length / 1024).toFixed(0)}kB, lostContinuity=${Boolean(out.lostContinuity)}`);
}
main();
