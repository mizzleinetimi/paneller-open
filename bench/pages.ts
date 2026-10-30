// The corpus. Each page is drawn to order, but what the prompt asked for and
// what Muse Image drew are not the same thing, so `truth` is what is actually
// on the page, counted by eye. Where the drawing ignored the brief, `note`
// says so - a page that failed to be hard is not evidence that the hard case
// works.

export type BenchPage = {
  id: string;
  /** What this page is meant to be hard at. */
  stresses: string;
  prompt: string;
  /** What is actually drawn, counted by eye. Not what was asked for. */
  truth: { panels: number; speech: number; sfx: number; caption: number };
  note?: string;
};

const STYLE = "Bold ink lines, flat colour, printed comic look.";

export const PAGES: BenchPage[] = [
  {
    id: "01-grid",
    stresses: "the easy case: a plain grid with white gutters",
    prompt: `A comic book page with six rectangular panels in a 3x2 grid, clean white gutters between them. A detective follows a cat through a rainy city. Two panels have speech balloons: "Where did it go?" and "Gotcha." One panel has a sound effect reading "THUMP". ${STYLE}`,
    truth: { panels: 6, speech: 2, sfx: 1, caption: 2 },
    note: "No captions were asked for; two white ones were drawn anyway.",
  },
  {
    id: "02-fullbleed",
    stresses: "full bleed: art to the page edge, no gutters",
    prompt: `A comic book page of three panels stacked vertically with NO gutters and NO white margins at all - the art of each panel runs edge to edge and the panels touch directly, separated only by a thin black line. A spaceship approaches a red planet. One speech balloon reads "We're going in." ${STYLE}`,
    truth: { panels: 3, speech: 1, sfx: 0, caption: 0 },
    note: "NOT full bleed. Asked for no gutters and no margin, Muse Image drew both. The hard case this page was meant to make is untested.",
  },
  {
    id: "03-slanted",
    stresses: "slanted gutters: not one panel is a rectangle",
    prompt: `A dynamic comic book page with five panels divided by strongly diagonal slanted gutters, so that every panel is a wedge or a trapezoid, none of them rectangular. A motorcycle chase through a desert. A speech balloon reads "Faster!" and a large sound effect reads "VROOOM". ${STYLE}`,
    truth: { panels: 5, speech: 1, sfx: 1, caption: 1 },
    note: "Genuinely slanted: every panel is a wedge. One caption drawn unasked.",
  },
  {
    id: "04-captions",
    stresses: "caption boxes: square narration boxes, not balloons",
    prompt: `A comic book page with four rectangular panels in a 2x2 grid. In the top-left corner of three of the panels there is a rectangular yellow narration caption box with square corners containing text: "Three years earlier.", "The city had changed." and "Nobody was waiting." Separately, one panel also has a rounded speech balloon reading "I'm home." A lone figure walks through an empty town. ${STYLE}`,
    truth: { panels: 4, speech: 1, sfx: 0, caption: 3 },
  },
  {
    id: "05-overlap",
    stresses: "an inset panel sitting on top of another, breaking its border",
    prompt: `A comic book page with three large rectangular panels, and a small square inset panel overlapping the corner of the middle one, breaking its border. A boxer trains in a gym. A speech balloon reads "Again." and a sound effect reads "SMACK". ${STYLE}`,
    truth: { panels: 4, speech: 1, sfx: 1, caption: 4 },
    note: "The inset does overlap. Four captions drawn unasked, one of them a page title banner.",
  },
  {
    id: "06-dense",
    stresses: "many small panels of uneven size, black and white",
    prompt: `A black and white manga page with nine panels of clearly uneven sizes - some tall and narrow, some short and wide - packed tightly with thin gutters. A schoolgirl runs for a train. Three speech balloons read "Wait!", "Hurry!" and "Made it." One sound effect reads "DASH". ${STYLE}`,
    truth: { panels: 8, speech: 3, sfx: 1, caption: 1 },
    note: "Eight panels drawn, not the nine asked for.",
  },
];
