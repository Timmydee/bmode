import type { Config } from "tailwindcss";

// Design tokens: a Discord-style dark system (layered charcoal surfaces,
// blurple accent, presence greens) with Cards Against Humanity-style
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
        // Surfaces, darkest to lightest: rail (server list), stage-2
        // (sidebars, raised panels), stage (the main chat area), and
        // stage-hover for rows under the pointer.
        rail: "#1E1F22",
        stage: "#313338",
        "stage-2": "#2B2D31",
        "stage-hover": "#393C41",
        "stage-line": "#3F4147",
        floating: "#111214",
        // Secondary buttons (Discord's grey button).
        "stage-button": "#4E5058",
        "stage-button-hover": "#6D6F78",
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
        paper: "#313338",
        "paper-2": "#2B2D31",
        ink: "#F2F3F5",
        "ink-soft": "#B5BAC1",
        "ink-faint": "#949BA4",
        hairline: "#3F4147",
        "stage-muted": "#949BA4",
        "stage-text": "#DBDEE1",
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
