import type { AudienceQuestion } from "../backend/types";

export function rankQuestions(
  questions: AudienceQuestion[],
  opts?: { includeHidden?: boolean },
): AudienceQuestion[] {
  const includeHidden = opts?.includeHidden ?? false;

  return questions
    .filter((question) => includeHidden || !question.hidden)
    .slice()
    .sort((a, b) => {
      if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
      return a.submittedAt.getTime() - b.submittedAt.getTime();
    });
}
