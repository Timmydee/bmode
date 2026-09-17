import { describe, expect, it } from "vitest";
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
});
