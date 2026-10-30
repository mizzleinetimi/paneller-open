# How well does it read a page?

Six pages, drawn to stress different things, counted by eye, then read by
`detectPage`. Run it yourself with `pnpm corpus && pnpm bench`.

_2026-10-30. Pages drawn by `muse-image-1.0`, read by `sam-3.1`._

## What is being measured

How many panels, speech bubbles, sound effects and caption boxes the reader
finds, against how many are actually drawn. Ground truth is counted by looking
at each page, **not** taken from the prompt that drew it: Muse Image regularly
drew something other than what was asked, and three of the six pages carry
caption boxes nobody requested. Where the drawing ignored the brief,
`bench/pages.ts` says so in a `note`.

A number alone would be dishonest without that, because a page that failed to be
hard is not evidence that the hard case works.

## Results

| Page | Stresses | Panels | Speech | Sound FX | Caption |
|---|---|---|---|---|---|
| 01-grid | plain 3x2 grid | **6/6** | 3/2 | 0/1 | 1/2 |
| 02-fullbleed | *intended* no gutters | **3/3** | **1/1** | **0/0** | **0/0** |
| 03-slanted | every panel a wedge | **5/5** | 2/1 | 2/1 | 0/1 |
| 04-captions | square narration boxes | **4/4** | **1/1** | **0/0** | **3/3** |
| 05-overlap | inset panel over a border | 3/4 | **1/1** | **1/1** | 3/4 |
| 06-dense | nine uneven manga panels | 9/8 | 4/3 | **1/1** | 0/1 |
| | **total found / drawn** | **30/30** | 12/9 | 4/4 | 7/11 |
| | **exact on** | 4/6 | 3/6 | 4/6 | 2/6 |

## What this says

**Panels are the strong result.** Thirty found against thirty drawn, and exact on
four of six pages, across a plain grid, a three-panel vertical, five slanted
wedges where no panel is a rectangle, and a dense black-and-white manga page.
The slanted page is the interesting one: a classical splitter that finds gutters
by flood-filling a flat background through straight corridors has no purchase on
wedges, and segmentation reads them without being told they are unusual.

The two inexact pages are honest misses:
- **05-overlap**: the small inset panel lying across another panel's border was
  not found, 3 of 4. An inset breaks the assumption that panels tile a page.
- **06-dense**: nine found where eight are drawn, one panel split in two.

**Lettering is noisier than layout.** Speech is found everywhere it exists but
over-claims by three across the corpus, consistently one too many on the busier
pages. Captions are the weak spot at 7 of 11, and no phrasing fixes it: see
[CONCEPTS.md](CONCEPTS.md).

**Concepts compete, and confidence should settle it.** Each concept is asked on
its own and knows nothing of the others, so a sound effect readily claims a
speech bubble and a caption claims a sound effect. Letting the surer claim keep
the pixels, rather than fixing an order of precedence, took sound effects from
7 found against 4 drawn to 4 against 4, and captions from 4 of 11 to 7 of 11,
with no change to panels. One page had its real "THUMP!" read as speech at 0.55
and as a sound effect at 0.91; a rule that always preferred speech threw the
better answer away.

## What is not measured here

- **Full-bleed pages, the case this was built to win.** Asked repeatedly for art
  running to the page edge with no gutters and no margin, Muse Image drew
  gutters and a margin anyway. The page that was meant to be hardest is not
  hard, and the claim that segmentation reads pages a gutter-finding splitter
  cannot remains **untested**. Real scanned manga would settle it; a corpus of
  pages we own would not, since the generator will not draw them.
- **Whether the panels are in the right place**, as opposed to how many there
  are. Counts are cheap to check and shapes are not.
- **Reading order**, which is verified by eye on the pages in the editor rather
  than scored here.
- Only six pages, each read once. Differences of one are noise.
