// Basic blocklist filter for word cloud / Q&A submissions (PRD §2, §7).
// Not exhaustive — v1 scope calls for a "basic" filter, not a moderation
// service. Matches are checked against a normalized (lowercased,
// punctuation-stripped, leetspeak-substituted) form of the input so trivial
// bypasses like "f*ck" or "sh1t" are still caught.
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

function normalize(text: string): string {
  const substituted = text
    .toLowerCase()
    .split("")
    .map((char) => LEET_SUBSTITUTIONS[char] ?? char)
    .join("");
  return substituted.replace(/[^a-z]/g, "");
}

export function containsProfanity(text: string): boolean {
  const normalized = normalize(text);
  if (normalized.length === 0) return false;
  return BLOCKLIST.some((term) => normalized.includes(term));
}
