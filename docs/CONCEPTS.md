# Which noun phrases SAM 3.1 answers to

SAM 3.1 takes one short noun phrase per request and returns a box and a mask for
every match. It is far more sensitive to the wording than the docs suggest:
comics jargon mostly finds nothing, plain description works, and two phrases for
the same thing can differ by 0.14 confidence.

Measured 2026-10-30 against `.spike/page.webp` — a 1280x1920 four-panel page
drawn by `muse-image-1.0`, holding two speech bubbles, one large "SKRRRT!!!"
sound effect, a bus-stop sign and a route board.

| Phrase | Matches | Confidence | Verdict |
|---|---|---|---|
| `comic panel` | 4 of 4 | 0.94-0.95 | use this |
| `speech bubble` | 2 of 2 | 0.96 | use this |
| `speech balloon` | 2 of 2 | 0.82 | works, less sure |
| `comic sound effect lettering` | 3 | 0.75-0.91 | use this |
| `word balloon` | 0 | - | jargon, nothing |
| `sound effect` | 0 | - | too abstract |
| `onomatopoeia` | 0 | - | jargon, nothing |
| `lettering` | 0 | - | too abstract |
| `large stylised lettering` | 0 | - | nothing |
| `caption box` | 0 | - | unsolved, see below |

## What this means for the editor

- Ask for one concept per call. Panels, bubbles and sound effects are three
  calls, about 3-8 s each and $0.0025 apiece, so a page costs under a cent to
  read and the calls can run at once.
- Prefer the word a reader would use over the word a comics letterer would.
  `speech bubble` beats `speech balloon`; both beat `word balloon`, which finds
  nothing at all.
- A rectangular panel's mask fills 98.8% of its own box, so for ordinary grids
  the box is the whole story. Masks earn their keep on slanted, irregular and
  full-bleed panels, and on bubbles, whose mask covers 63.5% of its box.

## Concepts overlap, so the page needs a second pass

`comic sound effect lettering` does not only find sound effects. On the test
page it returned three hits: the real "SKRRRT!!!", and both speech bubbles, with
boxes identical to the ones `speech bubble` returned. Each concept is asked in
its own request and knows nothing of the others, so nothing stops two of them
claiming the same pixels.

`detectPage` resolves it by intersection over union: where a sound effect covers
more than half the same area as a speech bubble, the sound effect is dropped,
because speech is the surer reading (0.96 against 0.75-0.91). On the test page
that turns 4 panels / 2 speech / 3 sound effects into 4 / 2 / 1, which is what
is actually drawn there.

Expect to need this for any new concept you add.

## Caption boxes, which are not solved

`caption box` found nothing on the first test page - because that page has no
caption boxes. The phrase is fine; the test was. On a page that does have them
it finds all three. But it does not hold up:

| Page | Captions drawn | `caption box` | `yellow caption` | `rectangular text box` |
|---|---|---|---|---|
| 04-captions (yellow) | 3 | 3 at 0.71-0.73 | 3 at 0.87 | 3 at 0.71 |
| 05-overlap (mixed) | 4 | **0** | 3 at 0.78 | **0** |
| 06-dense (white) | 1 | **0** | **0** | **0** |
| 01-grid (white) | 2 | 1 at 0.52 | **0** | 1 at 0.52 |

No phrase finds them dependably, and the two that work best disagree about
which pages they work on. `detectPage` asks both `caption box` and
`yellow caption` and merges the answers, which gets 7 of 11 across the corpus -
better than either alone, still the weakest thing here. A caption box is a
rectangle of text on a page made of rectangles of text, so this may be a limit
of describing it in words at all, rather than a phrase not yet guessed.

## Descriptions work as concepts

A concept does not have to be a kind of thing. "man in a green apron" and "man
in a red shirt" each find the right person on a page where both are drawn, and
that is what aims a speech balloon's tail: Muse Spark says who is speaking by
how they look, and SAM finds them. On a four-panel page of two men arguing in a
tailor's shop, every tail landed on the right head, including the panel where
the speaker is the smaller and less central of the two - the case that defeats
picking whoever is biggest.

Describing the same character the same way every time matters, since each
description costs a call and the answers are cached by description, not by
panel.

## Open
- Whether `comic panel` holds up on full-bleed pages with no gutters, which is
  exactly where a classical splitter gives up.
- Reading the text inside a bubble. SAM returns the shape, never the words.
