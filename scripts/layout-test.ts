import { planNextPage, planStory } from "../src/lib/compose";
async function main() {
  const { bible, plan } = await planStory(
    "a keke napep driver in Aba picks up a passenger who turns out to be his landlord",
    4,
  );
  console.log("page 1:", plan.layout, "|", plan.panels.map((p) => p.size).join(","));
  const p2 = await planNextPage(bible, [plan], "the landlord recognises him and demands the rent", 4);
  console.log("page 2:", p2.layout, "|", p2.panels.map((p) => p.size).join(","));
  const p3 = await planNextPage(bible, [plan, p2], "the keke breaks down and they push it", 4);
  console.log("page 3:", p3.layout, "|", p3.panels.map((p) => p.size).join(","));
}
main();
