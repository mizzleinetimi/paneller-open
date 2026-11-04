# Keeping a comic looking like itself

A comic is not one page, and the second page is where an image model usually
hands you different people in a different place. Two things hold it together,
and neither is free.

## What carries

The first page settles a **cast and a setting** as well as its panels. Each
character gets a `look` in the same handful of plain words a speaker is
described in - "man in a red cap" - and the plan asks for characters to be told
apart by clothing rather than by face, since a model will redraw a face long
before it redraws a jacket.

Those strings do double duty: later pages are planned against them, and a
speech balloon's tail already aims by them. Describe a character once and they
are both drawn and pointed at consistently.

## What the drawing is given

Pages after the first are drawn as an **edit against earlier pages** rather
than from text alone. The prompt has to insist on a new page: given an image,
the model's first instinct is to alter it. Told plainly - do not modify it, do
not include any part of it, do not copy its layout, draw a completely new page
in the same style with the same characters - it keeps faces, clothes and style
and lays out different panels.

## Which pages to reference

Referencing only the page before lets a comic walk away from itself one page at
a time, each page faithful to the last and the last page unrecognisable.

Measured on a three-page comic about a keke driver and his landlord in Aba,
drawn twice from the same first page and the same plans:

| Page 3 drawn from | Characters | The keke |
|---|---|---|
| the page before only | kept, cap gone dark | **became a hand-pushed cart** |
| the first page and the page before | kept, cap still red | still a yellow three-wheeler |

Both chains kept the two men recognisable. What drifted was everything else:
with only the page before to go on, the vehicle the whole story is about turned
into something else over two pages, each step small enough to look reasonable.

So a page is drawn against **the first page and the page before it**, which for
page two are the same image and so cost nothing extra.

**This is one comparison, not a study.** It cost about twenty cents to run and
is worth repeating before anyone leans on it. `scripts/drift-test.ts` draws
both chains.

## The cast is drawn once, first

Before any page, the whole cast is drawn standing in a row against a plain
background and kept. Every page is then held against that sheet.

One picture, however many characters. That matters: handing an image model
more reference pictures makes it worse rather than better, so a sheet of six
characters costs what a sheet of one does, where six separate portraits would
not. It also never drifts. Chaining page to page means page five inherits page
four's mistakes; a sheet is the same picture on page five as on page one.

A page is drawn against the sheet and the page before it - the sheet for who
the people are, the page before for where they are and what has just happened.

The looks are then **read back off the sheet** rather than trusted as planned.
They are written before anything exists and the drawing does not always oblige;
a cast planned around "man in a red cap" can come back in a dark one, and the
description is then wrong about its own comic. That matters twice, because the
same words are what a balloon's tail is aimed by. Reading them back makes them
true. It costs one call and happens while the first page is being drawn.
