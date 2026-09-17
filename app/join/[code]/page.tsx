"use client";

import { use, useEffect, useState, type FormEvent } from "react";
import { backend } from "@/lib/backend";
import type { AudienceQuestion, QAActivity, Session } from "@/lib/backend";
import { useParticipant } from "@/lib/hooks/useParticipant";
import { useSession } from "@/lib/hooks/useSession";
import { useActiveActivity } from "@/lib/hooks/useActiveActivity";
import { validateNickname } from "@/lib/game/validation";
import ParticipantCount from "@/components/shared/ParticipantCount";
import PollVoting from "@/components/poll/PollVoting";
import WordCloudInput from "@/components/wordcloud/WordCloudInput";
import QuestionComposer from "@/components/qa/QuestionComposer";
import QuestionList from "@/components/qa/QuestionList";

export default function JoinCodePage(props: PageProps<"/join/[code]">) {
  const { code } = use(props.params);

  const [sessionByCode, setSessionByCode] = useState<
    Session | null | undefined
  >(undefined);

  useEffect(() => {
    let cancelled = false;
    backend.sessions.getByJoinCode(code).then((found) => {
      if (!cancelled) setSessionByCode(found);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const sessionId = sessionByCode?.id ?? null;
  const {
    participant,
    loading: participantLoading,
    join,
  } = useParticipant(sessionId);
  const { session, participantCount } = useSession(sessionId, participant?.id);
  const { activity } = useActiveActivity(sessionId, session?.activeActivityId);

  const [nickname, setNickname] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    const trimmed = nickname.trim();
    if (trimmed) {
      const result = validateNickname(trimmed);
      if (!result.valid) {
        setJoinError(result.error ?? "That nickname isn't allowed.");
        return;
      }
    }
    setJoining(true);
    setJoinError(null);
    try {
      await join(trimmed || null);
    } catch (error) {
      setJoinError(
        error instanceof Error ? error.message : "Could not join.",
      );
    } finally {
      setJoining(false);
    }
  }

  if (sessionByCode === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center text-ink-soft">
        Looking for that session…
      </div>
    );
  }

  if (sessionByCode === null) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="font-display text-2xl font-semibold text-ink">
          No session with that code
        </p>
        <p className="text-ink-soft">
          Double-check the code with your host and try again.
        </p>
      </div>
    );
  }

  if (participantLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-ink-soft">
        Loading…
      </div>
    );
  }

  if (!participant) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-20">
        <p className="mb-1 text-sm text-ink-soft">Session {code}</p>
        <h1 className="mb-8 font-display text-3xl font-semibold text-ink">
          {sessionByCode.title}
        </h1>
        <form onSubmit={handleJoin} className="flex flex-col gap-4">
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Nickname (optional)"
            maxLength={24}
            autoFocus
            className="rounded-[10px] border-[1.5px] border-hairline bg-paper px-4 py-3 text-ink outline-none focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
          />
          {joinError && <p className="text-sm text-ember">{joinError}</p>}
          <button
            type="submit"
            disabled={joining}
            className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink disabled:opacity-60"
          >
            {joining ? "Joining…" : "Join session"}
          </button>
        </form>
      </div>
    );
  }

  if (activity?.kind === "poll") {
    return <PollVoting activity={activity} participantId={participant.id} />;
  }

  if (activity?.kind === "wordcloud") {
    return (
      <WordCloudInput activity={activity} participantId={participant.id} />
    );
  }

  if (activity?.kind === "qa") {
    return (
      <QASection
        sessionId={sessionByCode.id}
        activity={activity}
        participantId={participant.id}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-live">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-live" />
        Live
      </span>
      <h1 className="font-display text-2xl font-semibold text-ink">
        {sessionByCode.title}
      </h1>
      <p className="text-ink-soft">
        You’re in{participant.nickname ? `, ${participant.nickname}` : ""}.
        Waiting for the host to start something.
      </p>
      <ParticipantCount count={participantCount} variant="paper" />
    </div>
  );
}

function QASection({
  sessionId,
  activity,
  participantId,
}: {
  sessionId: string;
  activity: QAActivity;
  participantId: string;
}) {
  const [questions, setQuestions] = useState<AudienceQuestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    backend.qa.list(activity.id).then((list) => {
      if (!cancelled) setQuestions(list);
    });

    const unsubscribe = backend.realtime.subscribe(sessionId, (event) => {
      if (
        event.type === "question_added" &&
        event.question.activityId === activity.id
      ) {
        setQuestions((prev) =>
          prev.some((q) => q.id === event.question.id)
            ? prev
            : [...prev, event.question],
        );
      }
      if (
        event.type === "question_updated" &&
        event.question.activityId === activity.id
      ) {
        setQuestions((prev) =>
          prev.map((q) => (q.id === event.question.id ? event.question : q)),
        );
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [sessionId, activity.id]);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="font-display text-2xl font-bold text-ink">
        {activity.prompt}
      </h1>
      <QuestionComposer activity={activity} participantId={participantId} />
      <QuestionList
        sessionId={sessionId}
        activityId={activity.id}
        questions={questions}
        variant="paper"
        currentParticipantId={participantId}
      />
    </div>
  );
}
