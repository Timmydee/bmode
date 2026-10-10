import type { CSSProperties, ReactNode } from "react";
import type { CircleDepth } from "@/lib/backend";
import { CIRCLE_DEPTH_LABELS } from "@/lib/game/circle";
import Icon, { type IconName } from "@/components/shared/Icon";

// The pieces every Circle screen is built from: black question cards,
// white answer cards, face-down card backs, avatars with presence, and
// reaction pills. Cards follow Cards Against Humanity (heavy type, black
// or white stock, a small mark in the corner); everything around them
// follows the Discord-style dark system in tailwind.config.ts.

const AVATAR_COLORS = ["bg-blurple", "bg-live", "bg-gold", "bg-fuchsia", "bg-ember", "bg-stage-button"];

// Same name, same colour, on every screen.
function avatarColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function Avatar({
  name,
  size = "md",
  presence,
  speaking = false,
  shape = "round",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  // A dot in the corner: "online" (green) or "busy" (yellow, still answering).
  presence?: "online" | "busy";
  speaking?: boolean;
  shape?: "round" | "squircle";
}) {
  const dims = size === "sm" ? "h-6 w-6 text-[11px]" : size === "lg" ? "h-12 w-12 text-lg" : "h-8 w-8 text-sm";
  const dot = size === "lg" ? "h-4 w-4 border-[3px]" : "h-3 w-3 border-2";
  return (
    <span className="relative inline-flex shrink-0">
      <span
        aria-hidden
        className={`flex items-center justify-center font-display font-bold text-white ${dims} ${avatarColor(name)} ${
          shape === "round" ? "rounded-full" : "rounded-2xl"
        } ${speaking ? "animate-speaking" : ""}`}
      >
        {name.trim().charAt(0).toUpperCase() || "?"}
      </span>
      {presence && (
        <span
          className={`absolute -right-0.5 -bottom-0.5 rounded-full border-stage-2 ${dot} ${
            presence === "online" ? "bg-live" : "bg-gold"
          }`}
        />
      )}
    </span>
  );
}

function CardMark({ tone }: { tone: "black" | "white" }) {
  return (
    <span
      className={`flex items-center gap-1.5 font-card text-[11px] font-extrabold tracking-tight ${
        tone === "black" ? "text-white/70" : "text-card-muted"
      }`}
    >
      <span
        aria-hidden
        className={`inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] ${tone === "black" ? "bg-white/70" : "bg-card-ink"}`}
      />
      Bmode
    </span>
  );
}

const DEPTH_DOTS: Record<CircleDepth, string> = { 1: "●○○", 2: "●●○", 3: "●●●" };

// The black card: the question everyone answers.
export function QuestionCard({
  text,
  depth,
  size = "md",
  className = "",
}: {
  text: string;
  depth: CircleDepth;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col justify-between rounded-2xl bg-card-black text-white shadow-[0_12px_32px_rgb(0_0_0/45%)] ring-1 ring-white/15 ${
        size === "lg" ? "min-h-64 gap-10 p-8 sm:p-10" : "min-h-44 gap-6 p-6"
      } ${className}`}
    >
      <p
        className={`font-card font-extrabold tracking-tight text-balance ${
          size === "lg" ? "text-3xl leading-[1.12] sm:text-[2.6rem]" : "text-[1.6rem] leading-[1.15]"
        }`}
      >
        {text}
      </p>
      <div className="flex items-center justify-between">
        <CardMark tone="black" />
        <span className="font-card text-[11px] font-bold tracking-wide text-white/60 uppercase">
          <span aria-hidden className="mr-1.5 tracking-[0.15em]">
            {DEPTH_DOTS[depth]}
          </span>
          {CIRCLE_DEPTH_LABELS[depth]}
        </span>
      </div>
    </div>
  );
}

// The white card: one person's answer, with their name in the corner.
export function AnswerCard({
  text,
  nickname,
  skipped = false,
  isMine = false,
  spotlight = false,
  size = "md",
  children,
}: {
  text: string | null;
  nickname: string;
  skipped?: boolean;
  isMine?: boolean;
  spotlight?: boolean;
  size?: "md" | "lg";
  // Reactions and anything else that sits under the card's text.
  children?: ReactNode;
}) {
  return (
    <div
      className={`card-face relative flex h-full flex-col justify-between gap-5 rounded-2xl bg-card-white text-card-ink shadow-[0_8px_24px_rgb(0_0_0/35%)] ${
        size === "lg" ? "min-h-48 p-6" : "min-h-36 p-5"
      } ${spotlight ? "ring-4 ring-blurple ring-offset-2 ring-offset-stage" : ""} ${skipped ? "opacity-60" : ""}`}
    >
      {spotlight && (
        <span className="absolute -top-3 left-4 rounded-full bg-blurple px-2.5 py-0.5 font-display text-[11px] font-bold tracking-wide text-white uppercase">
          Spotlight
        </span>
      )}
      <p
        className={`font-card font-extrabold tracking-tight text-pretty ${
          size === "lg" ? "text-2xl leading-tight" : "text-xl leading-snug"
        } ${skipped ? "text-card-muted italic" : ""}`}
      >
        {skipped ? "Passed on this one" : text}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={nickname} size="sm" />
          <span className="truncate text-sm font-semibold text-card-muted">
            {nickname}
            {isMine && " (you)"}
          </span>
        </span>
        {children}
      </div>
    </div>
  );
}

// A card lying face down: played but not revealed yet.
export function CardBack({
  label,
  size = "md",
  tilt = 0,
  className = "",
}: {
  label?: string;
  size?: "sm" | "md";
  tilt?: number;
  className?: string;
}) {
  return (
    <div
      style={{ "--card-tilt": `${tilt}deg`, transform: `rotate(${tilt}deg)` } as CSSProperties}
      className={`card-back-pattern flex flex-col items-center justify-center gap-2 rounded-2xl text-white shadow-[0_8px_20px_rgb(0_0_0/40%)] ring-1 ring-white/10 ${
        size === "sm" ? "h-28 w-20" : "h-40 w-28"
      } ${className}`}
    >
      <span aria-hidden className="h-4 w-4 rotate-45 rounded-[3px] bg-blurple" />
      <span className="font-card text-xs font-extrabold tracking-tight">Bmode</span>
      {label && <span className="sr-only">{label}</span>}
    </div>
  );
}

// An empty place at the table, for someone still answering.
export function CardSlot({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <div
      aria-hidden
      className={`rounded-2xl border-2 border-dashed border-stage-line ${size === "sm" ? "h-28 w-20" : "h-40 w-28"}`}
    />
  );
}

// Turns a card over once, after `delayMs`, then leaves it face up.
// Remounting (a new key) is the only way to replay it.
export function FlipCard({ delayMs = 0, children }: { delayMs?: number; children: ReactNode }) {
  return (
    <div className="card-flip h-full">
      <div className="card-flip-inner h-full" style={{ "--flip-delay": `${delayMs}ms` } as CSSProperties}>
        {children}
        <div aria-hidden className="card-face-back card-back-pattern flex items-center justify-center rounded-2xl">
          <span className="h-5 w-5 rotate-45 rounded-[3px] bg-blurple" />
        </div>
      </div>
    </div>
  );
}

// A Discord-style reaction: an icon and a count in a pill, outlined and
// filled in once you've reacted.
export function ReactionPill({
  icon = "heart",
  count,
  active = false,
  onClick,
  label,
  tone = "light",
}: {
  icon?: IconName;
  count: number;
  active?: boolean;
  onClick?: () => void;
  label: string;
  // "light" sits on a white card, "dark" on the dark surfaces.
  tone?: "light" | "dark";
}) {
  const base = "inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-sm font-semibold tabular-nums";
  const colors = active
    ? "border-fuchsia bg-fuchsia/15 text-fuchsia"
    : tone === "light"
      ? "border-transparent bg-black/[0.06] text-card-muted"
      : "border-transparent bg-stage-2 text-ink-soft";
  if (!onClick) {
    return (
      <span className={`${base} ${colors}`} aria-label={`${count} ${label}`}>
        <Icon name={icon} filled className="h-4 w-4 text-fuchsia" />
        {count}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      onClick={onClick}
      className={`${base} ${colors} transition-transform hover:border-fuchsia/60 active:scale-90`}
    >
      <Icon name={icon} filled={active} className="h-4 w-4" />
      {count > 0 ? count : <Icon name="plus" className="h-3 w-3" />}
    </button>
  );
}

// A Discord embed: a raised panel with a coloured bar down its left edge.
export function Embed({
  accent = "blurple",
  title,
  children,
  className = "",
}: {
  accent?: "blurple" | "gold" | "live" | "fuchsia";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const bar = { blurple: "border-blurple", gold: "border-gold", live: "border-live", fuchsia: "border-fuchsia" }[accent];
  return (
    <div className={`rounded-md border-l-4 bg-stage-2 px-4 py-3 ${bar} ${className}`}>
      {title && <p className="mb-0.5 font-display text-sm font-bold text-ink">{title}</p>}
      <div className="text-sm text-ink-soft">{children}</div>
    </div>
  );
}

// "# friday-hangout": a circle's name written as a channel.
export function channelName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "circle"
  );
}

// The Sparks counter, styled like a server boost pill.
export function SparksPill({ value, label = "Sparks" }: { value: number; label?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-2.5 py-1 font-display text-sm font-bold tabular-nums text-gold"
      title={label}
    >
      <Icon name="sparkle" className="h-4 w-4" />
      {value}
      <span className="sr-only">{label}</span>
    </span>
  );
}
