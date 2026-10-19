import { describe, expect, it } from "vitest";
import { CIRCLE_QUESTIONS } from "./circle-questions";
import { containsProfanity } from "./profanity";

describe("containsProfanity", () => {
  it("flags blocklisted words", () => {
    expect(containsProfanity("shit")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(containsProfanity("SHIT")).toBe(true);
  });

  it("catches basic leetspeak substitution", () => {
    expect(containsProfanity("sh1t")).toBe(true);
  });

  it("catches punctuation-obfuscated attempts", () => {
    expect(containsProfanity("s.h.i.t")).toBe(true);
  });

  it("allows clean words", () => {
    expect(containsProfanity("flexible")).toBe(false);
    expect(containsProfanity("commute")).toBe(false);
  });

  it("treats an empty string as clean", () => {
    expect(containsProfanity("")).toBe(false);
  });

  it("catches blocked words with common endings", () => {
    expect(containsProfanity("that was fucking great")).toBe(true);
    expect(containsProfanity("I was pissed")).toBe(true);
    expect(containsProfanity("you dickhead")).toBe(true);
  });

  it("does not match across words or inside clean words", () => {
    expect(containsProfanity("Who has shaped who you are?")).toBe(false);
    expect(containsProfanity("Would you pass it on?")).toBe(false);
    expect(containsProfanity("What do you hope this group is still doing?")).toBe(false);
    expect(containsProfanity("What's the most embarrassing song you know?")).toBe(false);
    expect(containsProfanity("My class went to the grass field")).toBe(false);
    expect(containsProfanity("Who're you bringing?")).toBe(false);
  });

  it("passes every question in the bank", () => {
    const flagged = CIRCLE_QUESTIONS.flatMap((q) => [q.text, q.followUp ?? ""]).filter((text) =>
      containsProfanity(text),
    );
    expect(flagged).toEqual([]);
  });
});
