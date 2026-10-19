"use client";

import { useState, type FormEvent } from "react";
import { backend } from "@/lib/backend";
import type { CircleAnswerMode, CirclePlannedQuestion, CircleVibe } from "@/lib/backend";
import { CIRCLE_VIBES, suggestQuestionSet } from "@/lib/game/circle";
import { CIRCLE_MIN_QUESTIONS, validateCircleDraft } from "@/lib/game/validation";
import { collectionCards } from "@/lib/cards/library";
import { PremiumPickerList } from "@/components/cards/PremiumDecks";

const ANSWER_MODES: { value: CircleAnswerMode; label: string; description: string }[] = [
  { value: "typed", label: "Typed", description: "Everyone types on their phone, then the answers flip over together" },
  { value: "out_loud", label: "Out loud", description: "Phones just say who’s ready, then you take turns talking" },
];

const DEFAULT_COUNT = 8;

const STEPS = ["name", "vibe", "answers", "ready"] as const;
type Step = (typeof STEPS)[number];

// Four short steps: name, vibe, how people answer, create. The questions
// are dealt at random from the vibe, so there's nothing to pick. Coming
// from the card library, the game plays the cards they picked instead.
export default function CreateCircleForm({
  sessionId,
  initialVibe = "know",
  initialCards = null,
  onCreated,
}: {
  sessionId: string;
  initialVibe?: CircleVibe;
  initialCards?: string | null; // card ids from /cards, e.g. "3-12-40"
  onCreated: () => void;
}) {
  const [step, setStep] = useState<Step>("name");
  const [typedName, setTypedName] = useState("");
  const [vibe, setVibe] = useState<CircleVibe>(initialVibe);
  const [answerMode, setAnswerMode] = useState<CircleAnswerMode>("typed");
  const [pickedCards] = useState(() => plannedFromCards(initialCards, initialVibe));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Left blank, the game is named after its vibe ("# go-deeper").
  const name = typedName.trim() || CIRCLE_VIBES[vibe].name;
  const stepIndex = STEPS.indexOf(step);

  function go(to: Step) {
    setError(null);
    setStep(to);
  }

  async function create() {
    const questions =
      pickedCards.length > 0 ? pickedCards : suggestQuestionSet({ vibe, count: DEFAULT_COUNT, random: Math.random });
    const validation = validateCircleDraft({ name, questions });
    if (!validation.valid) {
      setError(validation.error ?? "Check the game before creating it.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await backend.circles.create({
        sessionId,
        name,
        settings: {
          vibe,
          questionCount: questions.length,
          rewardStyle: "together",
          answerMode,
          questions: questions.map((q) => ({ ...q, text: q.text.trim() })),
          customQuestions: [],
        },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the game.");
    } finally {
      setCreating(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === "ready") void create();
    else go(STEPS[stepIndex + 1]);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-stage-muted tabular-nums">
          {stepIndex + 1}/{STEPS.length}
        </span>
        <span className="flex flex-1 gap-1.5" aria-hidden>
          {STEPS.map((s, index) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full ${index <= stepIndex ? "bg-spotlight" : "bg-stage-line"}`}
            />
          ))}
        </span>
      </div>

      {step === "name" && (
        <div className="flex flex-col gap-2">
          <label htmlFor="circle-name" className="font-display text-xl font-bold text-white">
            Name your game
          </label>
          <input
            id="circle-name"
            value={typedName}
            onChange={(event) => setTypedName(event.target.value)}
            placeholder="e.g. Friday crew"
            maxLength={60}
            autoFocus
            className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
          />
          <p className="text-xs text-stage-muted">Optional. Leave it blank to name it after the vibe.</p>
        </div>
      )}

      {step === "vibe" && (
        <div className="flex flex-col gap-4">
          <ChoiceList
            label="Pick a vibe"
            options={(Object.keys(CIRCLE_VIBES) as CircleVibe[]).map((value) => ({
              value,
              label: CIRCLE_VIBES[value].name,
              description: CIRCLE_VIBES[value].description,
            }))}
            value={vibe}
            onChange={setVibe}
          />
          <PremiumPickerList />
        </div>
      )}

      {step === "answers" && (
        <ChoiceList label="How will people answer?" options={ANSWER_MODES} value={answerMode} onChange={setAnswerMode} />
      )}

      {step === "ready" && (
        <div className="flex flex-col gap-3">
          <h3 className="font-display text-xl font-bold text-white">Ready to create</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl border border-stage-line bg-stage-2 p-4 text-sm">
            <dt className="text-stage-muted">Name</dt>
            <dd className="text-white">{name}</dd>
            <dt className="text-stage-muted">Vibe</dt>
            <dd className="text-white">{CIRCLE_VIBES[vibe].name}</dd>
            <dt className="text-stage-muted">Answers</dt>
            <dd className="text-white">{ANSWER_MODES.find((m) => m.value === answerMode)?.label}</dd>
            <dt className="text-stage-muted">Cards</dt>
            <dd className="text-white">
              {pickedCards.length > 0
                ? `The ${pickedCards.length} cards you picked`
                : `${DEFAULT_COUNT} questions dealt at random`}
            </dd>
          </dl>
        </div>
      )}

      {error && <p className="text-sm text-ember">{error}</p>}

      <div className="flex flex-wrap gap-3">
        {stepIndex > 0 && (
          <button
            type="button"
            onClick={() => go(STEPS[stepIndex - 1])}
            className="rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
          >
            Back
          </button>
        )}
        <button
          type="submit"
          disabled={creating}
          className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
        >
          {step === "ready" ? (creating ? "Creating…" : "Create game") : "Next"}
        </button>
      </div>
    </form>
  );
}

// The picked cards in order. Fewer than a game needs (one shared card, say)
// are topped up with suggestions for the vibe, which the host can still swap.
function plannedFromCards(ids: string | null, vibe: CircleVibe): CirclePlannedQuestion[] {
  const picked: CirclePlannedQuestion[] = collectionCards(ids).map((card) => ({
    text: card.text,
    followUp: card.followUp,
    depth: card.depth,
    source: "library",
  }));
  if (picked.length === 0 || picked.length >= CIRCLE_MIN_QUESTIONS) return picked;
  const extra = suggestQuestionSet({
    vibe,
    count: DEFAULT_COUNT - picked.length,
    random: Math.random,
    avoidTexts: picked.map((q) => q.text),
  });
  return [...picked, ...extra];
}

// One choice per row, with its description, big enough to tap on a phone.
function ChoiceList<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; description: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-display text-xl font-bold text-white">{label}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`flex flex-col rounded-xl border-[1.5px] px-4 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-spotlight/60 ${
            option.value === value
              ? "border-spotlight bg-spotlight/10"
              : "border-stage-line bg-stage-2 hover:border-white/30"
          }`}
        >
          <span className="font-medium text-white">{option.label}</span>
          <span className="text-sm text-stage-muted">{option.description}</span>
        </button>
      ))}
    </fieldset>
  );
}
