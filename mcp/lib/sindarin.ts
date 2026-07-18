// Curated, attested Sindarin vocabulary for commit/PR titles, per
// CONTRIBUTING.md's convention: "favor words already attested in Tolkien's
// published texts... over obscure or reconstructed vocabulary." An LLM
// asked to invent Sindarin on the fly is exactly the failure mode that
// produces plausible-sounding nonsense, so proposeChange only ever picks
// from (or validates against) this fixed list — it never generates a word.
export interface SindarinWord {
  word: string;
  gloss: string;
  // Rough keyword hints used for scoring against a description/why, kept
  // deliberately small and literal rather than clever.
  keywords: string[];
}

export const SINDARIN_WORDS: SindarinWord[] = [
  { word: "Mellon", gloss: "friend", keywords: ["auth", "trust", "login", "friend", "access"] },
  { word: "Tirith", gloss: "watch, guard", keywords: ["validate", "guard", "watch", "check", "bounds", "security"] },
  { word: "Estel", gloss: "hope", keywords: ["new", "feature", "hope", "improve"] },
  { word: "Bar", gloss: "home, dwelling", keywords: ["home", "world", "spawn", "entity"] },
  { word: "Lasto", gloss: "listen! (imperative)", keywords: ["listen", "event", "socket", "broadcast"] },
  { word: "Certh", gloss: "rune", keywords: ["schema", "type", "encode", "format"] },
  { word: "Palan", gloss: "far and wide", keywords: ["broad", "wide", "range", "scope"] },
  { word: "Hen", gloss: "eye", keywords: ["ui", "display", "view", "render", "visible", "scroll"] },
  { word: "Suilad", gloss: "greeting", keywords: ["onboarding", "welcome", "new user", "docs"] },
  { word: "Echad", gloss: "camp, made", keywords: ["build", "setup", "scaffold", "infra"] },
  { word: "Lam", gloss: "tongue, language", keywords: ["chat", "message", "text", "content"] },
  { word: "Parf", gloss: "book", keywords: ["docs", "documentation", "readme"] },
  { word: "Cened", gloss: "sight, vision", keywords: ["observe", "read", "search", "look"] },
  { word: "Ephel", gloss: "outer fence", keywords: ["bounds", "limit", "fence", "wall", "edge"] },
  { word: "Gwaith", gloss: "people, work", keywords: ["ci", "workflow", "deploy", "work"] },
];

// This list intentionally stays short and conservative: every entry is
// either a well-known, high-confidence Tolkien-attested word (Mellon,
// Tirith, Estel, Suilad, Ephel, Gwaith, Palan, Hen, Lam, Cened, Certh) or
// already used as a real commit subject in this repo's history (Bar,
// Lasto, Echad, Parf) — nothing here is a guess made up for this file. If
// you want to extend it, verify against Tolkien's published texts first
// per CONTRIBUTING.md, don't just add a plausible-sounding word.

const SINDARIN_WORD_SET = new Set(SINDARIN_WORDS.map((w) => w.word));

export function isKnownSindarinWord(word: string): boolean {
  return SINDARIN_WORD_SET.has(word);
}

// Deterministic keyword scoring — not an LLM call, deliberately: the
// calling agent already has full LLM reasoning available and can pass
// sindarinWord explicitly for a more deliberate choice. This tool's job is
// mechanical orchestration, not creative judgment.
export function pickSindarinWord(text: string, recentlyUsed: string[]): SindarinWord {
  const lower = text.toLowerCase();
  let best: SindarinWord | null = null;
  let bestScore = 0;

  for (const candidate of SINDARIN_WORDS) {
    const score = candidate.keywords.filter((k) => lower.includes(k)).length;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (best) return best;

  const unused = SINDARIN_WORDS.find((w) => !recentlyUsed.includes(w.word));
  return unused ?? SINDARIN_WORDS[0];
}
