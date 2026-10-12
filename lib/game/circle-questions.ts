import type { CircleDepth } from "../backend/types";

// Starter question library for Circle games. Every question is tagged with
// a depth (1 Light, 2 Real, 3 Deep) and a follow-up for the spotlight;
// `reconnect` marks catch-up questions for groups who already know each
// other; `couples` marks questions written for two people who are
// together; `fun` marks light challenge-style questions. The PRD targets
// 300 questions at launch — this is the first set.
export interface LibraryQuestion {
  text: string;
  followUp: string;
  depth: CircleDepth;
  reconnect?: boolean;
  couples?: boolean;
  fun?: boolean;
}

// Every question in the bank has a permanent id: card pages (/cards/12) and
// shared collections (/cards/set/3-12-40) are linked by it. Never reuse or
// renumber an id; give new questions the next number up.
export interface BankQuestion extends LibraryQuestion {
  id: number;
}

export const CIRCLE_QUESTIONS: readonly BankQuestion[] = [
  { id: 1, text: "What's a small thing that made you happy this week?", followUp: "What made it land so well?", depth: 1 },
  { id: 2, text: "If you could master any skill overnight, what would it be?", followUp: "What's the first thing you'd do with it?", depth: 1 },
  { id: 3, text: "What's your go-to comfort food?", followUp: "Who first made it for you?", depth: 1 },
  { id: 4, text: "What's the best trip you've ever taken?", followUp: "Would you go back, or keep it perfect in memory?", depth: 1 },
  { id: 5, text: "What song would play every time you walked into a room?", followUp: "Why that one?", depth: 1 },
  { id: 6, text: "What's something you're weirdly good at?", followUp: "How did you find out?", depth: 1 },
  { id: 7, text: "What did you want to be when you were ten?", followUp: "What's left of that dream today?", depth: 1 },
  { id: 8, text: "What's the best advice you've ignored?", followUp: "Do you regret it?", depth: 1 },
  { id: 9, text: "If today had a title, what would it be?", followUp: "And what would you want tomorrow's to be?", depth: 1 },
  { id: 10, text: "What hobby would you pick up if you had the time?", followUp: "What's really stopping you?", depth: 1 },
  { id: 11, text: "What's a movie you could watch again and again?", followUp: "Which scene gets you every time?", depth: 1 },
  { id: 12, text: "What's the most useless thing you own but can't throw away?", followUp: "What's the story behind it?", depth: 1 },
  { id: 13, text: "What's a food you hated as a kid but love now?", followUp: "What changed?", depth: 1 },
  { id: 14, text: "Morning person or night owl?", followUp: "What do you save your best hours for?", depth: 1 },
  { id: 15, text: "Who's the funniest person you know?", followUp: "What's the last thing they said that made you laugh?", depth: 1 },
  { id: 16, text: "What's something you've changed your mind about in the last few years?", followUp: "What changed it?", depth: 2 },
  { id: 17, text: "Who has shaped who you are more than they know?", followUp: "Have you ever told them?", depth: 2 },
  { id: 18, text: "What are you proud of that nobody ever asks about?", followUp: "Why does it matter to you?", depth: 2 },
  { id: 19, text: "What does a perfect ordinary day look like for you?", followUp: "How close is your life to it right now?", depth: 2 },
  { id: 20, text: "When do you feel most like yourself?", followUp: "How could you get more of that?", depth: 2 },
  { id: 21, text: "What's a risk you're glad you took?", followUp: "What almost stopped you?", depth: 2 },
  { id: 22, text: "What's something people often get wrong about you?", followUp: "Where do you think that comes from?", depth: 2 },
  { id: 23, text: "What are you looking forward to right now?", followUp: "What would make it even better?", depth: 2 },
  { id: 24, text: "What's a lesson you had to learn twice?", followUp: "What finally made it stick?", depth: 2 },
  { id: 25, text: "What does friendship mean to you now, compared with five years ago?", followUp: "What changed it?", depth: 2 },
  { id: 26, text: "What's a compliment you still remember?", followUp: "Who said it, and why did it stay with you?", depth: 2 },
  { id: 27, text: "Where is a place that feels like home but isn't your house?", followUp: "What makes it feel that way?", depth: 2 },
  { id: 28, text: "What's something you're learning about yourself lately?", followUp: "How did you notice?", depth: 2 },
  { id: 29, text: "What habit are you trying to build?", followUp: "How's it really going?", depth: 2 },
  { id: 30, text: "What would you do more of if nobody was watching?", followUp: "What's stopping you now?", depth: 2 },
  { id: 31, text: "What's something you think about often but rarely say out loud?", followUp: "Why does it stay with you?", depth: 3 },
  { id: 32, text: "What do you need more of in your life right now?", followUp: "What would help you get it?", depth: 3 },
  { id: 33, text: "When did you last feel truly understood?", followUp: "What did that person do?", depth: 3 },
  { id: 34, text: "What's a fear that has shaped your choices?", followUp: "Is it still steering you?", depth: 3 },
  { id: 35, text: "What would you want people to say about you when you're not in the room?", followUp: "Do you think they do?", depth: 3 },
  { id: 36, text: "What's a moment that changed the direction of your life?", followUp: "Did you know it at the time?", depth: 3 },
  { id: 37, text: "What are you still trying to forgive, in someone else or in yourself?", followUp: "What would letting go look like?", depth: 3 },
  { id: 38, text: "What part of your life feels unfinished?", followUp: "What's one small step toward finishing it?", depth: 3 },
  { id: 39, text: "What do you wish you could tell your younger self?", followUp: "Would they have listened?", depth: 3 },
  { id: 40, text: "What does love look like to you, day to day?", followUp: "Who shows it to you that way?", depth: 3 },
  { id: 41, text: "Is there something you're carrying that this group could help with?", followUp: "What would help look like?", depth: 3 },
  { id: 42, text: "When did you last cry, and why?", followUp: "Did it help?", depth: 3 },
  { id: 43, text: "What's the biggest thing that's changed for you since we last really caught up?", followUp: "How do you feel about it?", depth: 1, reconnect: true },
  { id: 44, text: "What's a memory of this group that you still think about?", followUp: "Why that one?", depth: 1, reconnect: true },
  { id: 45, text: "What's taking up most of your headspace lately?", followUp: "Is it the good kind or the heavy kind?", depth: 2, reconnect: true },
  { id: 46, text: "What's something new in your life that we don't know about yet?", followUp: "How did it start?", depth: 1, reconnect: true },
  { id: 47, text: "What's one thing we should do together soon?", followUp: "Okay, when?", depth: 1, reconnect: true },
  { id: 48, text: "What's been your biggest win since we last saw each other?", followUp: "Who did you celebrate it with?", depth: 2, reconnect: true },
  { id: 49, text: "What's a small thing I do that makes your day better?", followUp: "When did you first notice it?", depth: 1, couples: true },
  { id: 50, text: "What was your first impression of me?", followUp: "How wrong were you?", depth: 1, couples: true },
  { id: 51, text: "What's our best inside joke?", followUp: "Where did it start?", depth: 1, couples: true },
  { id: 52, text: "What's your favourite photo of us, and why?", followUp: "What was happening just before it was taken?", depth: 1, couples: true },
  { id: 53, text: "If we had a free day tomorrow, how would you want to spend it together?", followUp: "What's stopping us?", depth: 1, couples: true },
  { id: 54, text: "What's a song that reminds you of us?", followUp: "When did it become ours?", depth: 1, couples: true },
  { id: 55, text: "Which of our dates would you happily repeat?", followUp: "What would you change the second time?", depth: 1, couples: true },
  { id: 56, text: "What's something you've learned from me?", followUp: "Have you ever told me?", depth: 2, couples: true },
  { id: 57, text: "When did you first feel at home with me?", followUp: "What was I doing?", depth: 2, couples: true },
  { id: 58, text: "What's a habit of mine you secretly love?", followUp: "And one you'd quietly retire?", depth: 2, couples: true },
  { id: 59, text: "What's something we should start doing together this year?", followUp: "What's the first step?", depth: 2, couples: true },
  { id: 60, text: "When do you feel most supported by me?", followUp: "What could I do more of?", depth: 2, couples: true },
  { id: 61, text: "What's a moment you were really proud of me?", followUp: "Did you say so at the time?", depth: 2, couples: true },
  { id: 62, text: "What's a dream of yours I might not know about?", followUp: "How can I help with it?", depth: 3, couples: true },
  { id: 63, text: "What's something you've wanted to tell me but haven't found the moment for?", followUp: "What made now the moment?", depth: 3, couples: true },
  { id: 64, text: "What does feeling loved by me look like, day to day?", followUp: "When did you last feel it?", depth: 3, couples: true },
  { id: 65, text: "What's a hard time we got through that made us stronger?", followUp: "What got us through it?", depth: 3, couples: true },
  { id: 66, text: "Where do you hope we are in five years?", followUp: "What's one thing we can do this month toward it?", depth: 3, couples: true },
  { id: 67, text: "Would you rather talk to animals or speak every human language?", followUp: "What's the first conversation you'd have?", depth: 1, fun: true },
  { id: 68, text: "What's your most controversial food opinion?", followUp: "Defend it in one sentence.", depth: 1, fun: true },
  { id: 69, text: "Pitch a terrible business idea in one sentence.", followUp: "Who's your first investor?", depth: 1, fun: true },
  { id: 70, text: "Describe your week as a movie title.", followUp: "Who plays you?", depth: 1, fun: true },
  { id: 71, text: "If you were a kitchen appliance, which one would you be?", followUp: "What would you refuse to make?", depth: 1, fun: true },
  { id: 72, text: "You get one superpower, but it only works on Tuesdays. What is it?", followUp: "How do your Tuesdays change?", depth: 1, fun: true },
  { id: 73, text: "What would be the title of your autobiography?", followUp: "What's chapter one about?", depth: 1, fun: true },
  { id: 74, text: "Which fictional character would you swap lives with for a week?", followUp: "What's the first thing you'd do?", depth: 1, fun: true },
  { id: 75, text: "What's a hill you'd die on that really doesn't matter?", followUp: "How long have you been up there?", depth: 1, fun: true },
  { id: 76, text: "Rate your cooking out of ten. What's your signature dish?", followUp: "Who would you cook it for?", depth: 1, fun: true },
  { id: 77, text: "If your pet (or dream pet) could talk, what would it complain about?", followUp: "Is it right?", depth: 1, fun: true },
  { id: 78, text: "What's the most chaotic thing you've done on a whim?", followUp: "Would you do it again?", depth: 1, fun: true },
  { id: 79, text: "What's the best thing about the friends you have now?", followUp: "How did you find them?", depth: 1, reconnect: true },
  { id: 80, text: "What's a tradition you'd love this group to start?", followUp: "When's the first one?", depth: 1, reconnect: true },
  { id: 81, text: "What's something a friend did for you that you'll never forget?", followUp: "Have you told them?", depth: 2, reconnect: true },
  { id: 82, text: "Who in your life do you wish you saw more often?", followUp: "What's in the way?", depth: 2, reconnect: true },
  { id: 83, text: "What do you bring to a friendship that you're proud of?", followUp: "And what do you need back?", depth: 2, reconnect: true },
  { id: 84, text: "When did a friend show up for you when you really needed it?", followUp: "What did it teach you?", depth: 3, reconnect: true },
];
