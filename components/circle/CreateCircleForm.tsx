"use client";

import { useState, type FormEvent } from "react";
import { backend } from "@/lib/backend";
import type {
  CircleAnswerMode,
  CircleDepth,
  CirclePlannedQuestion,
  CircleRewardStyle,
  CircleVibe,
} from "@/lib/backend";
import { CIRCLE_DEPTH_LABELS, CIRCLE_VIBES, suggestQuestionSet } from "@/lib/game/circle";
import { validateCircleDraft } from "@/lib/game/validation";
import CircleQuestionPicker from "./CircleQuestionPicker";

const REWARD_STYLES: { value: CircleRewardStyle; label: string; description: string }[] = [
  { value: "together", label: "Together", description: "One shared score, no rankings" },
  { value: "competitive", label: "Competitive", description: "Everyone’s Sparks are ranked at the end" },
];

const ANSWER_MODES: { value: CircleAnswerMode; label: string; description: string }[] = [
  { value: "typed", label: "Typed", description: "Answers appear on every phone" },
  { value: "out_loud", label: "Out loud", description: "Phones just say who’s ready; you talk" },
];

const DEFAULT_COUNT = 8;

// Two steps: set the game up, then see and shape the exact questions
// before anything is created. The picker starts from a suggested set for
// the chosen vibe so a host can create a game in two taps, or curate it.
export default function CreateCircleForm({
  sessionId,
  initialVibe = "know",
  onCreated,
}: {
  sessionId: string;
  initialVibe?: CircleVibe;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<"setup" | "questions">("setup");
  const [name, setName] = useState("Circle");
  const [vibe, setVibe] = useState<CircleVibe>(initialVibe);
  const [rewardStyle, setRewardStyle] = useState<CircleRewardStyle>("together");
  const [answerMode, setAnswerMode] = useState<CircleAnswerMode>("typed");
  const [questions, setQuestions] = useState<CirclePlannedQuestion[]>([]);
  // Which vibe the current list was suggested for, and whether the host
  // has touched it since — a hand-edited list is never replaced silently.
  const [suggestedFor, setSuggestedFor] = useState<CircleVibe | null>(null);
  const [edited, setEdited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function goToQuestions() {
    if (name.trim().length === 0) {
      setError("Give the game a name.");
      return;
    }
    setError(null);
    if (questions.length === 0 || (suggestedFor !== vibe && !edited)) {
      setQuestions(suggestQuestionSet({ vibe, count: DEFAULT_COUNT, random: Math.random }));
      setSuggestedFor(vibe);
      setEdited(false);
    }
    setStep("questions");
  }

  function updateQuestions(next: CirclePlannedQuestion[]) {
    setQuestions(next);
    setEdited(true);
  }

  function resuggest(count: number) {
    setQuestions(suggestQuestionSet({ vibe, count, random: Math.random }));
    setSuggestedFor(vibe);
    setEdited(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
        name: name.trim(),
        settings: {
          vibe,
          questionCount: questions.length,
          rewardStyle,
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

  if (step === "setup") {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-sm font-medium text-stage-muted">
          Create a Circle (everyone answers the same question on their own phone)
        </p>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Game name"
          className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
        />
        <OptionGroup
          label="Vibe"
          options={(Object.keys(CIRCLE_VIBES) as CircleVibe[]).map((value) => ({
            value,
            label: CIRCLE_VIBES[value].name,
            description: CIRCLE_VIBES[value].description,
          }))}
          value={vibe}
          onChange={setVibe}
        />
        <OptionGroup label="Rewards" options={REWARD_STYLES} value={rewardStyle} onChange={setRewardStyle} />
        <OptionGroup label="Answers" options={ANSWER_MODES} value={answerMode} onChange={setAnswerMode} />
        {error && <p className="text-sm text-ember">{error}</p>}
        <button
          type="button"
          onClick={goToQuestions}
          className="self-start rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink"
        >
          Next: pick the questions
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-stage-muted">
          {name.trim()} · {CIRCLE_VIBES[vibe].name} · pick the questions
        </p>
        <DepthSummary questions={questions} />
      </div>

      <CircleQuestionPicker vibe={vibe} questions={questions} onChange={updateQuestions} onSuggest={resuggest} />

      {error && <p className="text-sm text-ember">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep("setup");
          }}
          className="rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={creating}
          className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
        >
          {creating ? "Creating…" : `Create Circle with ${questions.length} questions`}
        </button>
      </div>
    </form>
  );
}

function DepthSummary({ questions }: { questions: CirclePlannedQuestion[] }) {
  const count = (depth: CircleDepth) => questions.filter((q) => q.depth === depth).length;
  return (
    <p className="text-xs text-stage-muted">
      {([1, 2, 3] as CircleDepth[])
        .filter((depth) => count(depth) > 0)
        .map((depth) => `${count(depth)} ${CIRCLE_DEPTH_LABELS[depth]}`)
        .join(" · ")}
    </p>
  );
}

function OptionGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const selected = options.find((option) => option.value === value);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm text-stage-muted">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            onClick={() => onChange(option.value)}
            className={`rounded-[10px] px-4 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-spotlight/60 ${
              option.value === value
                ? "bg-spotlight text-spotlight-ink"
                : "border-[1.5px] border-stage-line text-stage-text"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {selected?.description && <p className="text-xs text-stage-muted">{selected.description}</p>}
    </fieldset>
  );
}
