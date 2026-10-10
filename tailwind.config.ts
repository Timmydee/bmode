import type { Config } from "tailwindcss";

// Design tokens: a Discord-style dark system on deep indigo (layered
// surfaces, blurple accent, presence greens) with Cards Against Humanity-style
// black question cards and white answer cards on top. Do not hardcode
// these hex values in components; reference the Tailwind color names.
//
// The older token names (stage, paper, ink, spotlight…) are kept so every
// screen picks up the new look; they now all resolve to the dark system.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces, darkest to lightest: rail (inset fields, the area
        // behind an invite), stage (the main background), stage-2 (raised
        // panels and sidebars), and stage-hover for highlighted rows.
        rail: "#0C0D1E",
        stage: "#14152B",
        "stage-2": "#1E2042",
        "stage-hover": "#282B56",
        "stage-line": "#2E3162",
        floating: "#090A17",
        // Secondary buttons.
        "stage-button": "#33376E",
        "stage-button-hover": "#40458A",
        // Primary action and brand accent: Discord's blurple. The name
        // "spotlight" is kept for the existing call sites.
        spotlight: "#5865F2",
        "spotlight-hover": "#4752C4",
        "spotlight-ink": "#FFFFFF",
        blurple: "#5865F2",
        "blurple-soft": "#949CF7",
        // "Live / changing right now" and presence. Renamed from the PRD's
        // "current" because bg-current aliases to CSS currentColor.
        live: "#23A55A",
        "live-ink": "#FFFFFF",
        ember: "#F23F43",
        success: "#23A55A",
        "success-ink": "#FFFFFF",
        // Sparks (the group's reward currency) and hearts.
        gold: "#F0B232",
        fuchsia: "#EB459E",
        // Paper used to be the light player surface; players now share the
        // dark system, so these point at the same surfaces as stage.
        paper: "#14152B",
        "paper-2": "#1E2042",
        ink: "#F3F4FB",
        "ink-soft": "#B9BCDB",
        "ink-faint": "#8E92BE",
        hairline: "#2E3162",
        "stage-muted": "#8E92BE",
        "stage-text": "#DDDFF5",
        // The cards themselves: black question cards, white answer cards.
        "card-black": "#0B0B0C",
        "card-white": "#FFFFFF",
        "card-ink": "#0B0B0C",
        "card-muted": "#6D6F78",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        card: ["var(--font-card)"],
      },
    },
  },
};

export default config;
