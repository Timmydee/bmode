"use client";

import { useState, type FormEvent } from "react";
import { backend } from "@/lib/backend";
import type { CircleAnswerMode, CircleRewardStyle, CircleVibe } from "@/lib/backend";
import { CIRCLE_VIBES } from "@/lib/game/circle";
import {
  CIRCLE_MAX_CUSTOM_QUESTIONS,
  CIRCLE_QUESTION_COUNTS,
  parseCustomQuestions,
  validateCircleDraft,
} from "@/lib/game/validation";

const REWARD_STYLES: { value: CircleRewardStyle; label: string; description: string }[] = [
  { value: "together", label: "Together", description: "One shared score, no rankings" },
  { value: "competitive", label: "Competitive", description: "Everyone’s Sparks are ranked at the end" },
];

const ANSWER_MODES: { value: CircleAnswerMode; label: string; description: string }[] = [
  { value: "typed", label: "Typed", description: "Answers appear on every phone" },
  { value: "out_loud", label: "Out loud", description: "Phones just say who’s ready; you talk" },
];

export default function CreateCircleForm({
  sessionId,
  onCreated,
}: {
  sessionId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("Circle");
  const [vibe, setVibe] = useState<CircleVibe>("know");
  const [questionCount, setQuestionCount] = useState<number>(8);
  const [rewardStyle, setRewardStyle] = useState<CircleRewardStyle>("together");
  const [answerMode, setAnswerMode] = useState<CircleAnswerMode>("typed");
  const [customRaw, setCustomRaw] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const customQuestions = parseCustomQuestions(customRaw);
    const validation = validateCircleDraft({ name, questionCount, customQuestions });
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
        settings: { vibe, questionCount, rewardStyle, answerMode, customQuestions },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the game.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
      <OptionGroup
        label="Questions"
        options={CIRCLE_QUESTION_COUNTS.map((count) => ({ value: count, label: String(count) }))}
        value={questionCount}
        onChange={setQuestionCount}
      />
      <OptionGroup label="Rewards" options={REWARD_STYLES} value={rewardStyle} onChange={setRewardStyle} />
      <OptionGroup label="Answers" options={ANSWER_MODES} value={answerMode} onChange={setAnswerMode} />

      <label className="flex flex-col gap-2">
        <span className="text-sm text-stage-muted">
          Your own questions (optional, one per line, up to {CIRCLE_MAX_CUSTOM_QUESTIONS}). They’re mixed in
          with ours.
        </span>
        <textarea
          value={customRaw}
          onChange={(event) => setCustomRaw(event.target.value)}
          rows={3}
          placeholder="What’s a trip we still need to take together?"
          className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
        />
      </label>

      {error && <p className="text-sm text-ember">{error}</p>}

      <button
        type="submit"
        disabled={creating}
        className="self-start rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
      >
        {creating ? "Creating…" : "Create Circle"}
      </button>
    </form>
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
