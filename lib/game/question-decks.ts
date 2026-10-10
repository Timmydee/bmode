import type { CircleVibe } from "../backend/types";
import { CIRCLE_QUESTIONS, type LibraryQuestion } from "./circle-questions";

// The sample decks on the landing page. Each one is a handful of real
// questions from the library and the vibe its "Play this deck" button
// starts, so what people see there is what they'll get in the game.
export interface QuestionDeck {
  id: "relationship" | "friendship" | "tribe";
  name: string;
  tagline: string;
  vibe: CircleVibe;
  questions: LibraryQuestion[];
}

const BY_TEXT = new Map(CIRCLE_QUESTIONS.map((question) => [question.text, question]));

function pick(texts: string[]): LibraryQuestion[] {
  return texts.flatMap((text) => BY_TEXT.get(text) ?? []);
}

export const QUESTION_DECKS: readonly QuestionDeck[] = [
  {
    id: "relationship",
    name: "Relationship",
    tagline: "For the two of you",
    vibe: "couples",
    questions: pick([
      "What was your first impression of me?",
      "What's our best inside joke?",
      "What's a habit of mine you secretly love?",
      "When did you first feel at home with me?",
      "What's a dream of yours I might not know about?",
    ]),
  },
  {
    id: "friendship",
    name: "Friendship",
    tagline: "For old friends catching up",
    vibe: "reconnect",
    questions: pick([
      "What's something new in your life that we don't know about yet?",
      "What's a memory of this group that you still think about?",
      "What's been your biggest win since we last saw each other?",
      "What does friendship mean to you now, compared with five years ago?",
      "Who has shaped who you are more than they know?",
    ]),
  },
  {
    id: "tribe",
    name: "Tribe",
    tagline: "For your crew, team or community",
    vibe: "know",
    questions: pick([
      "What song would play every time you walked into a room?",
      "What's something you're weirdly good at?",
      "What are you proud of that nobody ever asks about?",
      "What's something people often get wrong about you?",
      "Is there something you're carrying that this group could help with?",
    ]),
  },
];
