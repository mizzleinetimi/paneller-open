/**
 * What to tell someone when a model says no.
 *
 * The APIs answer with their own JSON, and putting that on the screen tells a
 * reader nothing they can act on while showing them the inside of the program.
 * These say what happened and what to try instead.
 */
export function readable(e: unknown, what: "page" | "panel" | "lettering" | "translation"): string {
  const raw = e instanceof Error ? e.message : String(e);

  if (/content_policy_violation|content management policy|refused by the content filter|safety/i.test(raw)) {
    return what === "panel"
      ? "The drawing model would not redraw that panel. Try describing the change differently."
      : "The drawing model would not draw that. Try putting what happens on the page another way.";
  }
  if (/could not be reached|fetch failed|ETIMEDOUT|ECONNRESET/i.test(raw)) {
    return "Could not reach the models. Check the connection and try again.";
  }
  if (/ran out of tokens|returned nothing/i.test(raw)) {
    return "The planning model stopped before it answered. Try again.";
  }
  if (/\b429\b|rate limit/i.test(raw)) return "Too many requests at once. Wait a moment and try again.";
  if (/\b401\b|\b403\b|MODEL_API_KEY/i.test(raw)) return "The Meta Model API key is missing or not accepted.";
  if (/no panels/i.test(raw)) return "The planning model returned a page with no panels. Try again.";

  return `Could not draw that ${what}. ${raw.slice(0, 120)}`;
}
