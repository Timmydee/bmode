import type { CircleDepth } from "../backend/types";

// Starter question library for Circle games. Every question is tagged with
// a depth (1 Light, 2 Real, 3 Deep) and a follow-up for the spotlight;
// `reconnect` marks catch-up questions for groups who already know each
// other; `couples` marks questions written for two people who are
// together. The PRD targets 300 questions at launch — this is the first set.
export interface LibraryQuestion {
  text: string;
  followUp: string;
  depth: CircleDepth;
  reconnect?: boolean;
  couples?: boolean;
}

export const CIRCLE_QUESTIONS: readonly LibraryQuestion[] = [
  { text: "What's a small thing that made you happy this week?", followUp: "What made it land so well?", depth: 1 },
  { text: "If you could master any skill overnight, what would it be?", followUp: "What's the first thing you'd do with it?", depth: 1 },
  { text: "What's your go-to comfort food?", followUp: "Who first made it for you?", depth: 1 },
  { text: "What's the best trip you've ever taken?", followUp: "Would you go back, or keep it perfect in memory?", depth: 1 },
  { text: "What song would play every time you walked into a room?", followUp: "Why that one?", depth: 1 },
  { text: "What's something you're weirdly good at?", followUp: "How did you find out?", depth: 1 },
  { text: "What did you want to be when you were ten?", followUp: "What's left of that dream today?", depth: 1 },
  { text: "What's the best advice you've ignored?", followUp: "Do you regret it?", depth: 1 },
  { text: "If today had a title, what would it be?", followUp: "And what would you want tomorrow's to be?", depth: 1 },
  { text: "What hobby would you pick up if you had the time?", followUp: "What's really stopping you?", depth: 1 },
  { text: "What's a movie you could watch again and again?", followUp: "Which scene gets you every time?", depth: 1 },
  { text: "What's the most useless thing you own but can't throw away?", followUp: "What's the story behind it?", depth: 1 },
  { text: "What's a food you hated as a kid but love now?", followUp: "What changed?", depth: 1 },
  { text: "Morning person or night owl?", followUp: "What do you save your best hours for?", depth: 1 },
  { text: "Who's the funniest person you know?", followUp: "What's the last thing they said that made you laugh?", depth: 1 },
  { text: "What's something you've changed your mind about in the last few years?", followUp: "What changed it?", depth: 2 },
  { text: "Who has shaped who you are more than they know?", followUp: "Have you ever told them?", depth: 2 },
  { text: "What are you proud of that nobody ever asks about?", followUp: "Why does it matter to you?", depth: 2 },
  { text: "What does a perfect ordinary day look like for you?", followUp: "How close is your life to it right now?", depth: 2 },
  { text: "When do you feel most like yourself?", followUp: "How could you get more of that?", depth: 2 },
  { text: "What's a risk you're glad you took?", followUp: "What almost stopped you?", depth: 2 },
  { text: "What's something people often get wrong about you?", followUp: "Where do you think that comes from?", depth: 2 },
  { text: "What are you looking forward to right now?", followUp: "What would make it even better?", depth: 2 },
  { text: "What's a lesson you had to learn twice?", followUp: "What finally made it stick?", depth: 2 },
  { text: "What does friendship mean to you now, compared with five years ago?", followUp: "What changed it?", depth: 2 },
  { text: "What's a compliment you still remember?", followUp: "Who said it, and why did it stay with you?", depth: 2 },
  { text: "Where is a place that feels like home but isn't your house?", followUp: "What makes it feel that way?", depth: 2 },
  { text: "What's something you're learning about yourself lately?", followUp: "How did you notice?", depth: 2 },
  { text: "What habit are you trying to build?", followUp: "How's it really going?", depth: 2 },
  { text: "What would you do more of if nobody was watching?", followUp: "What's stopping you now?", depth: 2 },
  { text: "What's something you think about often but rarely say out loud?", followUp: "Why does it stay with you?", depth: 3 },
  { text: "What do you need more of in your life right now?", followUp: "What would help you get it?", depth: 3 },
  { text: "When did you last feel truly understood?", followUp: "What did that person do?", depth: 3 },
  { text: "What's a fear that has shaped your choices?", followUp: "Is it still steering you?", depth: 3 },
  { text: "What would you want people to say about you when you're not in the room?", followUp: "Do you think they do?", depth: 3 },
  { text: "What's a moment that changed the direction of your life?", followUp: "Did you know it at the time?", depth: 3 },
  { text: "What are you still trying to forgive, in someone else or in yourself?", followUp: "What would letting go look like?", depth: 3 },
  { text: "What part of your life feels unfinished?", followUp: "What's one small step toward finishing it?", depth: 3 },
  { text: "What do you wish you could tell your younger self?", followUp: "Would they have listened?", depth: 3 },
  { text: "What does love look like to you, day to day?", followUp: "Who shows it to you that way?", depth: 3 },
  { text: "Is there something you're carrying that this group could help with?", followUp: "What would help look like?", depth: 3 },
  { text: "When did you last cry, and why?", followUp: "Did it help?", depth: 3 },
  { text: "What's the biggest thing that's changed for you since we last really caught up?", followUp: "How do you feel about it?", depth: 1, reconnect: true },
  { text: "What's a memory of this group that you still think about?", followUp: "Why that one?", depth: 1, reconnect: true },
  { text: "What's taking up most of your headspace lately?", followUp: "Is it the good kind or the heavy kind?", depth: 2, reconnect: true },
  { text: "What's something new in your life that we don't know about yet?", followUp: "How did it start?", depth: 1, reconnect: true },
  { text: "What's one thing we should do together soon?", followUp: "Okay, when?", depth: 1, reconnect: true },
  { text: "What's been your biggest win since we last saw each other?", followUp: "Who did you celebrate it with?", depth: 2, reconnect: true },
  { text: "What's a small thing I do that makes your day better?", followUp: "When did you first notice it?", depth: 1, couples: true },
  { text: "What was your first impression of me?", followUp: "How wrong were you?", depth: 1, couples: true },
  { text: "What's our best inside joke?", followUp: "Where did it start?", depth: 1, couples: true },
  { text: "What's your favourite photo of us, and why?", followUp: "What was happening just before it was taken?", depth: 1, couples: true },
  { text: "If we had a free day tomorrow, how would you want to spend it together?", followUp: "What's stopping us?", depth: 1, couples: true },
  { text: "What's a song that reminds you of us?", followUp: "When did it become ours?", depth: 1, couples: true },
  { text: "Which of our dates would you happily repeat?", followUp: "What would you change the second time?", depth: 1, couples: true },
  { text: "What's something you've learned from me?", followUp: "Have you ever told me?", depth: 2, couples: true },
  { text: "When did you first feel at home with me?", followUp: "What was I doing?", depth: 2, couples: true },
  { text: "What's a habit of mine you secretly love?", followUp: "And one you'd quietly retire?", depth: 2, couples: true },
  { text: "What's something we should start doing together this year?", followUp: "What's the first step?", depth: 2, couples: true },
  { text: "When do you feel most supported by me?", followUp: "What could I do more of?", depth: 2, couples: true },
  { text: "What's a moment you were really proud of me?", followUp: "Did you say so at the time?", depth: 2, couples: true },
  { text: "What's a dream of yours I might not know about?", followUp: "How can I help with it?", depth: 3, couples: true },
  { text: "What's something you've wanted to tell me but haven't found the moment for?", followUp: "What made now the moment?", depth: 3, couples: true },
  { text: "What does feeling loved by me look like, day to day?", followUp: "When did you last feel it?", depth: 3, couples: true },
  { text: "What's a hard time we got through that made us stronger?", followUp: "What got us through it?", depth: 3, couples: true },
  { text: "Where do you hope we are in five years?", followUp: "What's one thing we can do this month toward it?", depth: 3, couples: true },
];
