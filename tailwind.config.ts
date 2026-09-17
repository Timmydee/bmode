import type { Config } from "tailwindcss";

// Design tokens sourced from agents/design-system.html — do not hardcode
// these hex values in components; reference the Tailwind color names below.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stage: "#14121F",
        "stage-2": "#1D1A2C",
        "stage-line": "#332F47",
        spotlight: "#F5B759",
        "spotlight-ink": "#4A2E00",
        // PRD §6 names this token "current" — renamed to "live" here
        // because "current" is a Tailwind-reserved keyword (bg-current /
        // text-current alias to CSS currentColor), which silently no-ops
        // this exact violet instead of applying it. Same hex, same
        // "live / changing right now" meaning from design-system.html.
        live: "#7C6FF0",
        "live-ink": "#EFECFF",
        ember: "#E85D4C",
        paper: "#FBF7EF",
        "paper-2": "#F2ECDD",
        ink: "#1C1A24",
        "ink-soft": "#5B5768",
        "ink-faint": "#8B8697",
        // Not in the PRD §6 token list, but used throughout the Stage
        // mockups in design-system.html (.stage-brand, .stage-code,
        // .stage-count) for muted text on dark surfaces — the Stage
        // counterpart to ink-soft/ink-faint on Paper.
        "stage-muted": "#B5AFD1",
        // Also not in the §6 list: the hairline border/divider color used
        // throughout Paper surfaces (inputs, cards, section rules).
        hairline: "#DED6BE",
        // Also not in the §6 list: readable secondary text on Stage (e.g.
        // .stage-bar-label) — brighter/more prominent than stage-muted,
        // used where a label needs to be legible, not just present.
        "stage-text": "#E5E1F2",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
    },
  },
};

export default config;
