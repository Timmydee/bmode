"use client";

import { useState } from "react";
import type { CircleDepth, CirclePlannedQuestion, CircleVibe } from "@/lib/backend";
import { CIRCLE_QUESTIONS } from "@/lib/game/circle-questions";
import { CIRCLE_DEPTH_LABELS, swapQuestion } from "@/lib/game/circle";
import {
  CIRCLE_CUSTOM_QUESTION_MAX_LENGTH,
  CIRCLE_MAX_QUESTIONS,
  CIRCLE_QUESTION_COUNTS,
  validateCircleQuestion,
} from "@/lib/game/validation";

const DEPTHS: CircleDepth[] = [1, 2, 3];

const DEPTH_CHIP: Record<CircleDepth, string> = {
  1: "bg-stage-line text-stage-text",
  2: "bg-spotlight/20 text-spotlight",
  3: "bg-ember/20 text-ember",
};

interface CircleQuestionPickerProps {
  vibe: CircleVibe;
  questions: CirclePlannedQuestion[];
  onChange: (questions: CirclePlannedQuestion[]) => void;
  onSuggest: (count: number) => void;
}

// The host's question list for a Circle: the exact questions, in play
// order, with swap/reorder/remove on each, plus the library to browse
// and a box for writing their own.
export default function CircleQuestionPicker({ vibe, questions, onChange, onSuggest }: CircleQuestionPickerProps) {
  const [browsing, setBrowsing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const full = questions.length >= CIRCLE_MAX_QUESTIONS;

  function move(index: number, by: -1 | 1) {
    const target = index + by;
    if (target < 0 || target >= questions.length) return;
    const next = questions.slice();
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function swap(index: number) {
    const replacement = swapQuestion({
      question: questions[index],
      vibe,
      usedTexts: questions.map((q) => q.text),
      random: Math.random,
    });
    if (!replacement) {
      setNotice(`No other ${CIRCLE_DEPTH_LABELS[questions[index].depth]} questions left to swap in.`);
      return;
    }
    setNotice(null);
    onChange(questions.map((q, i) => (i === index ? replacement : q)));
  }

  function add(question: CirclePlannedQuestion) {
    if (full) {
      setNotice(`A Circle can have up to ${CIRCLE_MAX_QUESTIONS} questions.`);
      return;
    }
    setNotice(null);
    onChange([...questions, question]);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-stage-muted">
        <span>Suggest a fresh set of</span>
        {CIRCLE_QUESTION_COUNTS.map((count) => (
          <button
            key={count}
            type="button"
            onClick={() => onSuggest(count)}
            className="rounded-[10px] border-[1.5px] border-stage-line px-3 py-1 font-medium text-stage-text"
          >
            {count}
          </button>
        ))}
      </div>

      {questions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stage-line p-4 text-sm text-stage-muted">
          No questions yet. Suggest a set, browse the library or write your own.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {questions.map((question, index) => (
            <li
              key={question.text}
              className="flex items-start gap-3 rounded-xl border border-stage-line bg-stage-2 px-3 py-3"
            >
              <span className="w-5 pt-0.5 text-right font-display text-sm tabular-nums text-stage-muted">
                {index + 1}
              </span>
              <div className="flex flex-1 flex-col gap-1">
                <p className="text-white">{question.text}</p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 ${DEPTH_CHIP[question.depth]}`}>
                    {CIRCLE_DEPTH_LABELS[question.depth]}
                  </span>
                  {question.source === "custom" && <span className="text-stage-muted">Yours</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <IconButton label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
                  ↑
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={index === questions.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </IconButton>
                {question.source === "library" && (
                  <IconButton label="Swap for another question" onClick={() => swap(index)}>
                    ⇄
                  </IconButton>
                )}
                <IconButton label="Remove" onClick={() => onChange(questions.filter((_, i) => i !== index))}>
                  ×
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
      )}

      {notice && <p className="text-sm text-stage-muted">{notice}</p>}

      <WriteYourOwn onAdd={add} disabled={full} existing={questions} />

      <button
        type="button"
        onClick={() => setBrowsing((open) => !open)}
        aria-expanded={browsing}
        className="self-start text-sm text-stage-text underline"
      >
        {browsing ? "Hide the question library" : `Browse all ${CIRCLE_QUESTIONS.length} questions`}
      </button>
      {browsing && <LibraryBrowser vibe={vibe} questions={questions} onAdd={add} onChange={onChange} />}
    </div>
  );
}

function WriteYourOwn({
  onAdd,
  disabled,
  existing,
}: {
  onAdd: (question: CirclePlannedQuestion) => void;
  disabled: boolean;
  existing: CirclePlannedQuestion[];
}) {
  const [text, setText] = useState("");
  const [depth, setDepth] = useState<CircleDepth>(1);
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const result = validateCircleQuestion(text);
    if (!result.valid) {
      setError(result.error ?? "Check your question.");
      return;
    }
    if (existing.some((q) => q.text.trim().toLowerCase() === text.trim().toLowerCase())) {
      setError("That question is already on the list.");
      return;
    }
    setError(null);
    onAdd({ text: text.trim(), followUp: null, depth, source: "custom" });
    setText("");
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-stage-line p-3">
      <span className="text-sm text-stage-muted">Write your own</span>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            handleAdd();
          }
        }}
        maxLength={CIRCLE_CUSTOM_QUESTION_MAX_LENGTH}
        placeholder="What’s a trip we still need to take together?"
        className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-2.5 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
      />
      <div className="flex flex-wrap items-center gap-2">
        {DEPTHS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={depth === value}
            onClick={() => setDepth(value)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              depth === value ? DEPTH_CHIP[value] : "border border-stage-line text-stage-muted"
            }`}
          >
            {CIRCLE_DEPTH_LABELS[value]}
          </button>
        ))}
        <button
          type="button"
          onClick={handleAdd}
          disabled={disabled}
          className="ml-auto rounded-[10px] bg-spotlight px-4 py-1.5 text-sm font-medium text-spotlight-ink disabled:opacity-40"
        >
          Add
        </button>
      </div>
      {error && <p className="text-sm text-ember">{error}</p>}
    </div>
  );
}

function LibraryBrowser({
  vibe,
  questions,
  onAdd,
  onChange,
}: {
  vibe: CircleVibe;
  questions: CirclePlannedQuestion[];
  onAdd: (question: CirclePlannedQuestion) => void;
  onChange: (questions: CirclePlannedQuestion[]) => void;
}) {
  const [depth, setDepth] = useState<CircleDepth | "all">("all");
  const [search, setSearch] = useState("");
  const picked = new Set(questions.map((q) => q.text));
  const term = search.trim().toLowerCase();
  const shown = CIRCLE_QUESTIONS.filter(
    (q) =>
      (vibe === "reconnect" || !q.reconnect) &&
      (depth === "all" || q.depth === depth) &&
      (!term || q.text.toLowerCase().includes(term)),
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-stage-line bg-stage-2 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", ...DEPTHS] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={depth === value}
            onClick={() => setDepth(value)}
            className={`rounded-[10px] px-3 py-1 text-sm font-medium ${
              depth === value ? "bg-spotlight text-spotlight-ink" : "border-[1.5px] border-stage-line text-stage-text"
            }`}
          >
            {value === "all" ? "All" : CIRCLE_DEPTH_LABELS[value]}
          </button>
        ))}
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          className="min-w-0 flex-1 rounded-[10px] border-[1.5px] border-stage-line bg-stage px-3 py-1 text-sm text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight"
        />
      </div>
      <ul className="flex max-h-80 flex-col gap-1.5 overflow-y-auto pr-1">
        {shown.length === 0 && <li className="text-sm text-stage-muted">No questions match.</li>}
        {shown.map((q) => {
          const isPicked = picked.has(q.text);
          return (
            <li key={q.text}>
              <button
                type="button"
                aria-pressed={isPicked}
                onClick={() =>
                  isPicked
                    ? onChange(questions.filter((p) => p.text !== q.text))
                    : onAdd({ text: q.text, followUp: q.followUp, depth: q.depth, source: "library" })
                }
                className={`flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                  isPicked ? "bg-spotlight/15 text-white" : "text-stage-text hover:bg-stage"
                }`}
              >
                <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs ${DEPTH_CHIP[q.depth]}`}>
                  {CIRCLE_DEPTH_LABELS[q.depth]}
                </span>
                <span className="flex-1">{q.text}</span>
                <span className="shrink-0 text-xs text-stage-muted">{isPicked ? "Added ✓" : "+ Add"}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="h-8 w-8 rounded-lg border border-stage-line text-stage-text disabled:opacity-30"
    >
      {children}
    </button>
  );
}
