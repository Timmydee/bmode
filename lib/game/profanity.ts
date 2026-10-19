// Basic blocklist filter for word cloud / Q&A submissions (PRD §2, §7).
// Not exhaustive — v1 scope calls for a "basic" filter, not a moderation
// service. Each word is normalized (lowercased, punctuation-stripped,
// leetspeak-substituted) so trivial bypasses like "sh1t" or "s.h.i.t" are
// still caught. Matching is per word, not across the whole text: "has
// shaped", "pass it on" and "embarrassing" contain blocked letters but are
// clean, and matching across them blocked real questions from the bank.
const BLOCKLIST = [
  "anal",
  "arse",
  "ass",
  "asshole",
  "bastard",
  "bitch",
  "bollocks",
  "bullshit",
  "cock",
  "crap",
  "cunt",
  "damn",
  "dick",
  "dickhead",
  "fag",
  "faggot",
  "fuck",
  "jerkoff",
  "motherfucker",
  "nigger",
  "nigga",
  "piss",
  "prick",
  "pussy",
  "retard",
  "shit",
  "slut",
  "twat",
  "whore",
];

const LEET_SUBSTITUTIONS: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "@": "a",
  $: "s",
};

// Endings that keep a blocked word blocked ("shits", "fucking", "pissed").
const SUFFIXES = ["", "s", "es", "ed", "er", "ers", "ing", "in", "ty", "hole", "head"];

function normalize(word: string): string {
  return word
    .toLowerCase()
    .split("")
    .map((char) => LEET_SUBSTITUTIONS[char] ?? char)
    .join("")
    .replace(/[^a-z]/g, "");
}

export function containsProfanity(text: string): boolean {
  // Split on spaces and apostrophes so "who're" isn't read as one word.
  const words = text.split(/[\s'’]+/).map(normalize).filter(Boolean);
  return words.some((word) =>
    BLOCKLIST.some((term) => word.startsWith(term) && SUFFIXES.includes(word.slice(term.length))),
  );
}
