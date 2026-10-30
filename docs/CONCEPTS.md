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

## Open

- **Caption boxes** are not found by `caption box`. Try `rectangular text box`,
  `narration box`, `white box with text`.
- Whether `comic panel` holds up on full-bleed pages with no gutters, which is
  exactly where a classical splitter gives up.
