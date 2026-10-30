# Working with the three models

What the docs don't tell you, measured while building this. All timings are
from Port Harcourt, Nigeria, against `api.meta.ai`, 2026-10-30.

## Muse Image (`muse-image-1.0`)

- `/images/generations` draws from text alone. Worth knowing if you have used
  Muse through fal, which exposes only the edit endpoint.
- `/images/edits` takes one image or several; several compose into one scene.
- A four-panel page with correct lettering in **15-27 s**, $0.01 an image.
  Lettering came back exact across runs, which is not usually true of image
  models.
- `size` is a **ratio, not a pixel size**. Ask for 1024x1536 and you get that
  shape at whatever size it likes, so anything pasted back into a page has to be
  resized to the hole it came from.

## SAM 3.1 (`sam-3.1`)

- `/responses`, streaming, **one noun phrase per request**. Three concepts is
  three requests; run them at once.
- 3-8 s a concept, $2.50 per 1000 images, so reading a page costs under a cent.
- The phrase decides everything. See [CONCEPTS.md](CONCEPTS.md).
- Masks come back as base85 in a token stream. Use `@meta-sam/parser`; the
  grammar is not documented anywhere else. `decodeMaskToRaster` returns a bare
  `Uint8Array` - the dimensions are on `mask.width`/`mask.height`, not on the
  return value.
- `decodeMaskToSVGPath` traces **one pixel step at a time**: a plain rectangular
  panel is about 3200 points, in the mask's own coordinates rather than the
  page's. Expect to offset, simplify and, for anything rectangular, snap.

## Muse Spark (`muse-spark-1.1`)

- OpenAI-shaped `/chat/completions`. Multimodal: it reads images well, including
  small crops of comic lettering.
- **It is a reasoning model, and the reasoning comes out of `max_tokens`.** A
  one-line reading of a comic page spent **771 tokens thinking**. Ask for 400
  and you get `finish_reason: "length"` with `content: null` and no hint as to
  why. Give every call thousands of tokens.
- Reading three bubbles in one request: ~9 s. Translating three lines: ~10-12 s.
- It is good at knowing what it is looking at. Asked for the dialogue on a page,
  it listed the two spoken lines and noted separately that the sound effect was
  not dialogue, unprompted.

## The network

Calls drop. One `/chat/completions` failed mid-test with Node's unhelpful
`fetch failed`, and the same request succeeded immediately after. `metaPost`
retries a dropped connection or a 5xx three times with backoff, and never
retries a 4xx, where the prompt or the key is the problem and will stay that way.
