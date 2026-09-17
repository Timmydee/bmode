"use client";

import Link from "next/link";
import { use, useEffect, useState, type FormEvent } from "react";
import { backend } from "@/lib/backend";
import type { Activity, AudienceQuestion } from "@/lib/backend";
import { useSession } from "@/lib/hooks/useSession";
import { useActiveActivity } from "@/lib/hooks/useActiveActivity";
import { useLiveResults } from "@/lib/hooks/useLiveResults";
import JoinCode from "@/components/shared/JoinCode";
import QRCode from "@/components/shared/QRCode";
import ParticipantCount from "@/components/shared/ParticipantCount";
import PollResults from "@/components/poll/PollResults";
import WordCloudDisplay from "@/components/wordcloud/WordCloudDisplay";
import QuestionList from "@/components/qa/QuestionList";

export default function HostSessionPage(
  props: PageProps<"/host/[sessionId]">,
) {
  const { sessionId } = use(props.params);
  const { session, participantCount, loading } = useSession(
    sessionId,
    `host:${sessionId}`,
  );

  const [viewerId, setViewerId] = useState<string | null | undefined>(
    undefined,
  );
  useEffect(() => {
    backend.auth.getCurrentUserId().then(setViewerId);
    return backend.auth.onAuthChange(setViewerId);
  }, []);

  const { activity: activeActivity } = useActiveActivity(
    sessionId,
    session?.activeActivityId,
  );
  const liveResults = useLiveResults(
    sessionId,
    activeActivity?.id ?? null,
    activeActivity?.kind ?? null,
  );

  const [activities, setActivities] = useState<Activity[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (!sessionId) return;
    backend.activities.listBySession(sessionId).then(setActivities);
  }, [sessionId, refreshKey]);
  function refreshActivities() {
    setRefreshKey((key) => key + 1);
  }

  const qaActivityId =
    activeActivity?.kind === "qa" ? activeActivity.id : null;
  const [questionsLoaded, setQuestionsLoaded] = useState<{
    activityId: string;
    questions: AudienceQuestion[];
  } | null>(null);
  useEffect(() => {
    if (!sessionId || !qaActivityId) return;
    let cancelled = false;

    backend.qa.list(qaActivityId, { includeHidden: true }).then((list) => {
      if (cancelled) return;
      setQuestionsLoaded({ activityId: qaActivityId, questions: list });
    });

    const unsubscribe = backend.realtime.subscribe(sessionId, (event) => {
      if (
        event.type === "question_added" &&
        event.question.activityId === qaActivityId
      ) {
        setQuestionsLoaded((prev) => {
          if (!prev || prev.activityId !== qaActivityId) return prev;
          if (prev.questions.some((q) => q.id === event.question.id))
            return prev;
          return {
            activityId: qaActivityId,
            questions: [...prev.questions, event.question],
          };
        });
      }
      if (
        event.type === "question_updated" &&
        event.question.activityId === qaActivityId
      ) {
        setQuestionsLoaded((prev) => {
          if (!prev || prev.activityId !== qaActivityId) return prev;
          return {
            activityId: qaActivityId,
            questions: prev.questions.map((q) =>
              q.id === event.question.id ? event.question : q,
            ),
          };
        });
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId, qaActivityId]);
  const questions =
    questionsLoaded?.activityId === qaActivityId
      ? questionsLoaded.questions
      : [];

  const [actionError, setActionError] = useState<string | null>(null);

  async function handleActivate(activityId: string) {
    setActionError(null);
    try {
      await backend.activities.setStatus(activityId, "live");
      await backend.sessions.setActiveActivity(sessionId, activityId);
      const activated = await backend.activities.getById(activityId);
      if (activated) {
        await backend.realtime.publish(sessionId, {
          type: "activity_activated",
          activity: activated,
          serverTime: Date.now(),
        });
      }
      refreshActivities();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not activate that.",
      );
    }
  }

  async function handleClose(activityId: string) {
    setActionError(null);
    try {
      await backend.activities.setStatus(activityId, "closed");
      await backend.sessions.setActiveActivity(sessionId, null);
      await backend.realtime.publish(sessionId, {
        type: "activity_closed",
        activityId,
        serverTime: Date.now(),
      });
      refreshActivities();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not close that.",
      );
    }
  }

  if (loading || viewerId === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center bg-stage text-stage-muted">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-stage px-6 text-center text-white">
        <p className="font-display text-2xl font-semibold">
          Session not found
        </p>
        <p className="text-stage-muted">
          It may have been deleted, or the link is wrong. Go back to your
          sessions and try again.
        </p>
        <Link
          href="/host"
          className="mt-2 rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
        >
          Back to your sessions
        </Link>
      </div>
    );
  }

  if (viewerId !== session.hostId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-stage px-6 text-center text-white">
        <p className="font-display text-2xl font-semibold">
          You don’t have access to this session
        </p>
        <p className="text-stage-muted">
          Sign in as the host who created it to view this page.
        </p>
        <Link
          href="/host"
          className="mt-2 rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${session.joinCode}`
      : "";

  return (
    <div className="flex flex-1 flex-col bg-stage px-8 py-10 text-white sm:px-12 sm:py-14">
      <div className="mb-10 flex items-center justify-between">
        <span className="font-display text-[15px] font-bold tracking-[0.01em] text-stage-muted">
          Game Night
        </span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-stage-muted">
            Join at {typeof window !== "undefined" ? window.location.host : ""}
            <JoinCode code={session.joinCode} className="ml-1.5 text-white" />
          </span>
          <Link
            href={`/host/${sessionId}/present`}
            target="_blank"
            className="rounded-[10px] border-[1.5px] border-white/30 px-3 py-1.5 text-sm font-medium text-white"
          >
            Open projector view
          </Link>
        </div>
      </div>

      {activeActivity?.kind === "poll" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <h1 className="max-w-[22ch] text-center font-display text-3xl font-bold sm:text-4xl">
            {activeActivity.prompt}
          </h1>
          {liveResults && "byOption" in liveResults ? (
            <PollResults results={liveResults} />
          ) : (
            <p className="text-stage-muted">Loading results…</p>
          )}
          <button
            type="button"
            onClick={() => handleClose(activeActivity.id)}
            className="rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
          >
            Close poll
          </button>
        </div>
      ) : activeActivity?.kind === "wordcloud" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6">
          <h1 className="max-w-[22ch] text-center font-display text-3xl font-bold sm:text-4xl">
            {activeActivity.prompt}
          </h1>
          {liveResults && "words" in liveResults ? (
            <WordCloudDisplay results={liveResults} />
          ) : (
            <p className="text-stage-muted">Loading results…</p>
          )}
          <button
            type="button"
            onClick={() => handleClose(activeActivity.id)}
            className="rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
          >
            Close word cloud
          </button>
        </div>
      ) : activeActivity?.kind === "qa" ? (
        <div className="flex flex-1 flex-col items-center gap-6 py-6">
          <h1 className="max-w-[22ch] text-center font-display text-3xl font-bold sm:text-4xl">
            {activeActivity.prompt}
          </h1>
          <QuestionList
            sessionId={sessionId}
            activityId={activeActivity.id}
            questions={questions}
            variant="stage"
            moderatable
          />
          <button
            type="button"
            onClick={() => handleClose(activeActivity.id)}
            className="rounded-[10px] border-[1.5px] border-white/30 px-5 py-2.75 font-medium text-white"
          >
            Close Q&amp;A
          </button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-8 py-6 text-center">
          <h1 className="max-w-[16ch] font-display text-3xl font-bold sm:text-4xl">
            {session.title}
          </h1>
          {joinUrl && <QRCode url={joinUrl} />}
          <p className="text-stage-muted">
            Activate an activity below once your audience has joined.
          </p>
        </div>
      )}

      <div className="mt-10 border-t border-stage-line pt-8">
        {actionError && (
          <p className="mb-4 text-sm text-ember">{actionError}</p>
        )}
        <ActivityQueue
          activities={activities}
          hasLiveActivity={Boolean(activeActivity)}
          onActivate={handleActivate}
        />
        <CreatePollForm sessionId={sessionId} onCreated={refreshActivities} />
        <CreateWordCloudForm
          sessionId={sessionId}
          onCreated={refreshActivities}
        />
        <CreateQAForm sessionId={sessionId} onCreated={refreshActivities} />
      </div>

      <div className="mt-10 flex items-center justify-between">
        <ParticipantCount count={participantCount} variant="stage" />
      </div>
    </div>
  );
}

function ActivityQueue({
  activities,
  hasLiveActivity,
  onActivate,
}: {
  activities: Activity[];
  hasLiveActivity: boolean;
  onActivate: (activityId: string) => void;
}) {
  const queued = activities.filter((activity) => activity.status === "queued");
  if (queued.length === 0) return null;

  return (
    <ul className="mb-8 flex flex-col gap-2">
      {queued.map((activity) => (
        <li
          key={activity.id}
          className="flex items-center justify-between rounded-xl border border-stage-line bg-stage-2 px-4 py-3"
        >
          <span className="text-sm text-stage-text">{activity.prompt}</span>
          <button
            type="button"
            disabled={hasLiveActivity}
            onClick={() => onActivate(activity.id)}
            className="rounded-[10px] bg-spotlight px-4 py-2 text-sm font-medium text-spotlight-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Activate
          </button>
        </li>
      ))}
    </ul>
  );
}

function CreatePollForm({
  sessionId,
  onCreated,
}: {
  sessionId: string;
  onCreated: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  }

  function addOption() {
    setOptions((prev) => (prev.length < 6 ? [...prev, ""] : prev));
  }

  function removeOption(index: number) {
    setOptions((prev) =>
      prev.length > 2 ? prev.filter((_, i) => i !== index) : prev,
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    const trimmedOptions = options.map((opt) => opt.trim()).filter(Boolean);

    if (!trimmedPrompt) {
      setError("Give the poll a question.");
      return;
    }
    if (trimmedOptions.length < 2 || trimmedOptions.length > 6) {
      setError("Add between 2 and 6 options.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await backend.activities.create({
        sessionId,
        kind: "poll",
        prompt: trimmedPrompt,
        config: { options: trimmedOptions, resultsVisibleToParticipants: true },
      });
      setPrompt("");
      setOptions(["", ""]);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the poll.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm font-medium text-stage-muted">Create a poll</p>
      <input
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="What excites you most about remote work?"
        className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
      />
      <div className="flex flex-col gap-2">
        {options.map((option, index) => (
          <div key={index} className="flex gap-2">
            <input
              value={option}
              onChange={(event) => updateOption(index, event.target.value)}
              placeholder={`Option ${index + 1}`}
              className="flex-1 rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-2.5 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => removeOption(index)}
                aria-label={`Remove option ${index + 1}`}
                className="rounded-[10px] border-[1.5px] border-stage-line px-3 text-stage-muted"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>
      {options.length < 6 && (
        <button
          type="button"
          onClick={addOption}
          className="self-start text-sm text-stage-muted underline"
        >
          Add option
        </button>
      )}
      {error && <p className="text-sm text-ember">{error}</p>}
      <button
        type="submit"
        disabled={creating}
        className="mt-2 self-start rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
      >
        {creating ? "Creating…" : "Create poll"}
      </button>
    </form>
  );
}

function CreateWordCloudForm({
  sessionId,
  onCreated,
}: {
  sessionId: string;
  onCreated: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [maxWords, setMaxWords] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Give the word cloud a prompt.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await backend.activities.create({
        sessionId,
        kind: "wordcloud",
        prompt: trimmedPrompt,
        config: { maxWordsPerParticipant: maxWords },
      });
      setPrompt("");
      setMaxWords(1);
      onCreated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the word cloud.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
      <p className="text-sm font-medium text-stage-muted">Create a word cloud</p>
      <input
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="What's one word for how this project is going?"
        className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
      />
      <label className="flex items-center gap-2 text-sm text-stage-muted">
        Words per participant
        <select
          value={maxWords}
          onChange={(event) => setMaxWords(Number(event.target.value))}
          className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-2 py-1 text-white"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </label>
      {error && <p className="text-sm text-ember">{error}</p>}
      <button
        type="submit"
        disabled={creating}
        className="mt-2 self-start rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
      >
        {creating ? "Creating…" : "Create word cloud"}
      </button>
    </form>
  );
}

function CreateQAForm({
  sessionId,
  onCreated,
}: {
  sessionId: string;
  onCreated: () => void;
}) {
  const [prompt, setPrompt] = useState("Ask us anything");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      setError("Give the Q&A a prompt.");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await backend.activities.create({
        sessionId,
        kind: "qa",
        prompt: trimmedPrompt,
        config: { allowAnonymous: true },
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the Q&A.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3">
      <p className="text-sm font-medium text-stage-muted">Create a Q&amp;A</p>
      <input
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Ask us anything"
        className="rounded-[10px] border-[1.5px] border-stage-line bg-stage-2 px-4 py-3 text-white outline-none placeholder:text-stage-muted focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
      />
      {error && <p className="text-sm text-ember">{error}</p>}
      <button
        type="submit"
        disabled={creating}
        className="mt-2 self-start rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
      >
        {creating ? "Creating…" : "Create Q&A"}
      </button>
    </form>
  );
}
