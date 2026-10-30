import { planPage } from "../src/lib/compose";
async function main() {
  const plan = await planPage(
    "a tailor in Aba argues with a customer about a late order, then the customer notices the suit is perfect",
    4,
  );
  console.log("setting:", plan.setting, "\n");
  plan.panels.forEach((p, i) => {
    console.log(`${i + 1}. ${p.description.slice(0, 80)}`);
    if (p.speech) console.log(`   speech: "${p.speech}"  <- ${p.speaker ?? "(NO SPEAKER)"}`);
    if (p.sfx) console.log(`   sfx: "${p.sfx}"`);
    if (p.caption) console.log(`   caption: "${p.caption}"`);
  });
}
main();
