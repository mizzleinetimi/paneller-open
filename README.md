# Paneller Open

An open-source comic page editor, with the AI parts powered by Meta's models.

Draw a page, or bring one you already have. **Paneller Open reads a comic page
back into its parts** — every panel, every speech bubble, every sound effect —
using SAM 3.1, so a flat image becomes something you can actually edit. Panels
are polygons, so slanted and irregular layouts work, not just grids.

Built for the Meta Global AI Developer Hackathon, Oct–Nov 2026.

## What it does

- **Edit a page by hand.** Panels, speech bubbles, caption boxes and sound
  effects. Drag to move, type to letter, undo a hundred steps deep.
- **Read a page.** SAM 3.1 finds the panels and bubbles on any page — including
  ones you didn't make — and turns them into editable objects.
- **Draw a page.** Muse Image draws panel art from a prompt, or redraws a single
  panel without touching the rest of the page.
- **Letter it in another language.** Translate a bubble's text to fit the bubble
  it has to sit in.

No account, no server, no database. The document lives in your browser and
exports to PNG.

## Why the models matter here

A comic page isn't an image. It's panels, gutters, bubbles, reading order,
lettering and art, and each of those is a region with meaning. Image models
flatten all of it into pixels. Segmentation gives the structure back, which is
what makes the page editable rather than merely re-generatable.

The wording of a segmentation prompt decides whether it finds anything at all —
`speech bubble` scores 0.96 where `word balloon` finds nothing. What works and
what doesn't is written down in [docs/CONCEPTS.md](docs/CONCEPTS.md).

## Running it

```sh
pnpm install
cp .env.example .env.local   # add a Meta Model API key from https://dev.meta.ai
pnpm dev
```

Reading a page costs about $0.0075 (three segmentation calls). Drawing one is
$0.01 an image.

## Using it in your own app

The pieces are separable, and deliberately so:

| Module | What it gives you |
|---|---|
| `src/lib/meta/client.ts` | Muse Image: generate, edit, compose |
| `src/lib/meta/sam.ts` | SAM 3.1 segmentation, streaming, parsed |
| `src/lib/doc.ts` | The page model: polygon panels, bubbles |
| `src/components/` | The editor itself |

## Related

Paneller Open is the open editor. [Paneller](https://panellr.com) is the full
product: multi-character consistency, whole comics, and everything drawn for
you. This editor's reading and lettering work runs inside it.

## Licence

Apache-2.0.
