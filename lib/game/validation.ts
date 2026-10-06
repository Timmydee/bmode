import { containsProfanity } from "./profanity";

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const NICKNAME_MAX_LENGTH = 24;
const WORD_MAX_LENGTH = 24;
const QUESTION_MAX_LENGTH = 280;

function ok(): ValidationResult {
  return { valid: true };
}

function fail(error: string): ValidationResult {
  return { valid: false, error };
}

export function validateNickname(nickname: string): ValidationResult {
  const trimmed = nickname.trim();
  if (trimmed.length === 0) {
    return fail("Nickname can't be empty.");
  }
  if (trimmed.length > NICKNAME_MAX_LENGTH) {
    return fail(`Nickname must be ${NICKNAME_MAX_LENGTH} characters or fewer.`);
  }
  return ok();
}

export function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

export function validateWord(word: string): ValidationResult {
  const trimmed = word.trim();
  if (trimmed.length === 0) {
    return fail("Enter a word before submitting.");
  }
  if (/\s/.test(trimmed)) {
    return fail("Enter one word at a time.");
  }
  if (trimmed.length > WORD_MAX_LENGTH) {
    return fail(`Words must be ${WORD_MAX_LENGTH} characters or fewer.`);
  }
  if (containsProfanity(trimmed)) {
    return fail("That word isn't allowed here. Try a different one.");
  }
  return ok();
}

export function validateQuestion(text: string): ValidationResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return fail("Enter a question before submitting.");
  }
  if (trimmed.length > QUESTION_MAX_LENGTH) {
    return fail(`Questions must be ${QUESTION_MAX_LENGTH} characters or fewer.`);
  }
  if (containsProfanity(trimmed)) {
    return fail("That question isn't allowed here. Please rephrase it.");
  }
  return ok();
}

export function validatePollOptionSelection(
  optionId: string,
  validOptionIds: string[],
): ValidationResult {
  if (!optionId) {
    return fail("Choose an option before submitting.");
  }
  if (!validOptionIds.includes(optionId)) {
    return fail("That option is no longer available.");
  }
  return ok();
}

export interface RoundQuestionDraft {
  prompt: string;
  options: string[];
  correctOptionIndex: number;
}

// Shared by validateRoundDraft (checks the whole array before final submit)
// and the host page's per-question "Next" button (checks just the question
// being left, so a host can't silently skip past a blank one while
// stepping through a multi-question round with Back/Next).
export function validateRoundQuestionDraft(
  question: RoundQuestionDraft,
  questionNumber: number,
): ValidationResult {
  const trimmedOptions = question.options.map((opt) => opt.trim()).filter(Boolean);
  if (question.prompt.trim().length === 0) {
    return fail(`Question ${questionNumber} needs a prompt.`);
  }
  if (trimmedOptions.length < 2 || trimmedOptions.length > 6) {
    return fail(`Question ${questionNumber} needs between 2 and 6 options.`);
  }
  if (
    question.correctOptionIndex < 0 ||
    question.correctOptionIndex >= question.options.length ||
    !question.options[question.correctOptionIndex]?.trim()
  ) {
    return fail(`Mark the correct answer for question ${questionNumber}.`);
  }
  return ok();
}

export function validateRoundDraft(input: {
  name: string;
  timeLimitSeconds: number;
  questions: RoundQuestionDraft[];
}): ValidationResult {
  if (input.name.trim().length === 0) {
    return fail("Give the round a name.");
  }
  if (!Number.isInteger(input.timeLimitSeconds) || input.timeLimitSeconds <= 0) {
    return fail("Time limit must be a positive number of seconds.");
  }
  if (input.questions.length === 0) {
    return fail("Add at least one question.");
  }
  for (const [index, question] of input.questions.entries()) {
    const result = validateRoundQuestionDraft(question, index + 1);
    if (!result.valid) return result;
  }
  return ok();
}

export interface SurveyQuestionDraft {
  prompt: string;
  options: string[];
}

// Shared by validateSurveyDraft and the host page's per-question "Next"
// button — see validateRoundQuestionDraft above for why this is split out.
export function validateSurveyQuestionDraft(
  question: SurveyQuestionDraft,
  questionNumber: number,
): ValidationResult {
  const trimmedOptions = question.options.map((opt) => opt.trim()).filter(Boolean);
  if (question.prompt.trim().length === 0) {
    return fail(`Question ${questionNumber} needs a prompt.`);
  }
  if (trimmedOptions.length < 2 || trimmedOptions.length > 6) {
    return fail(`Question ${questionNumber} needs between 2 and 6 options.`);
  }
  return ok();
}

export function validateSurveyDraft(input: {
  name: string;
  questions: SurveyQuestionDraft[];
}): ValidationResult {
  if (input.name.trim().length === 0) {
    return fail("Give the survey a name.");
  }
  if (input.questions.length === 0) {
    return fail("Add at least one question.");
  }
  for (const [index, question] of input.questions.entries()) {
    const result = validateSurveyQuestionDraft(question, index + 1);
    if (!result.valid) return result;
  }
  return ok();
}

export const CIRCLE_ANSWER_MAX_LENGTH = 240;
export const CIRCLE_CUSTOM_QUESTION_MAX_LENGTH = 160;
export const CIRCLE_QUESTION_COUNTS = [5, 8, 12] as const;

export function validateCircleAnswer(text: string): ValidationResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return fail("Type an answer, or tap Skip.");
  }
  if (trimmed.length > CIRCLE_ANSWER_MAX_LENGTH) {
    return fail(`Answers must be ${CIRCLE_ANSWER_MAX_LENGTH} characters or fewer.`);
  }
  if (containsProfanity(trimmed)) {
    return fail("That answer includes a word that isn't allowed here. Please rephrase it.");
  }
  return ok();
}

export const CIRCLE_MIN_QUESTIONS = 3;
export const CIRCLE_MAX_QUESTIONS = 20;

export function validateCircleQuestion(text: string): ValidationResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return fail("Type a question first.");
  }
  if (trimmed.length > CIRCLE_CUSTOM_QUESTION_MAX_LENGTH) {
    return fail(`Questions must be ${CIRCLE_CUSTOM_QUESTION_MAX_LENGTH} characters or fewer.`);
  }
  if (containsProfanity(trimmed)) {
    return fail("That question includes a word that isn't allowed here. Please rephrase it.");
  }
  return ok();
}

export function validateCircleDraft(input: {
  name: string;
  questions: { text: string }[];
}): ValidationResult {
  if (input.name.trim().length === 0) {
    return fail("Give the game a name.");
  }
  if (input.questions.length < CIRCLE_MIN_QUESTIONS) {
    return fail(`Pick at least ${CIRCLE_MIN_QUESTIONS} questions.`);
  }
  if (input.questions.length > CIRCLE_MAX_QUESTIONS) {
    return fail(`Pick up to ${CIRCLE_MAX_QUESTIONS} questions.`);
  }
  for (const [index, question] of input.questions.entries()) {
    const result = validateCircleQuestion(question.text);
    if (!result.valid) return fail(`Question ${index + 1}: ${result.error}`);
  }
  return ok();
}
