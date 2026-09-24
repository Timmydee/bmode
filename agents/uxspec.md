# Live quiz and polling platform — UX specification

This document describes the target user experience for a Slido/Kahoot-style live event platform: a host runs a session, participants join from their phones with a code, and a projected big screen shows questions, results and leaderboards in real time. It covers the three surfaces, every screen and state, the scoring and gamification rules, the real-time model, and the quality bar. Build against this spec; where it says PLACEHOLDER, use a clearly marked stand-in asset.

## 1. Goals and quality bar

The experience should feel instant on the phone, theatrical on the big screen, and calm for the host.

- A first-time participant goes from scanning the QR code to sitting in the lobby in under 10 seconds, with no account and no app install.
- Every tap gets visible feedback within 100ms (optimistic UI), even on a slow mobile connection.
- A dropped connection never loses a player's name, avatar, score or streak; they rejoin automatically.
- Scoring is computed on the server from server timestamps. The client timer is only a display.
- The big screen is readable from the back of a hall: huge type, high contrast, nothing smaller than 24px at 1080p.
- A nervous first-time host can run a whole quiz by pressing one button repeatedly.

Non-goals for v1: power-ups, paid plans, native apps, custom themes per event (except logo upload), question banks/marketplace.

## 2. Surfaces and roles

| Surface | Who | Device | Job |
|---|---|---|---|
| Participant app (`/join`, `/play/:sessionId`) | Player | Phone, portrait | Join, answer, see personal feedback |
| Big screen (`/screen/:sessionId`) | Audience | Projector/TV, landscape 16:9 | The stage: question, live counts, reveals, leaderboard, podium |
| Host remote (`/host/:sessionId`) | Host | Laptop or phone | Control the flow, see who's in, moderate |
| Host editor (`/host/:sessionId/edit`) | Host | Laptop | Create questions and settings before the event |

The big screen and host remote are separate routes so the host can project one and control from the other. On a single laptop, the host remote must also work as a small overlay on top of the big screen view (toggle with a keyboard shortcut, see 7.3).

## 3. Activity types

All activity types share the same session shell (join, lobby, big screen, host remote). v1 priority order:

1. **Quiz question** (multiple choice, one correct answer, timed, scored). The game.
2. **Live poll** (multiple choice, no correct answer, results shown live or on reveal).
3. **Word cloud** (short free text, max 25 characters, frequent answers grow larger).
4. **Q&A** (participants submit questions, others upvote, host moderates and highlights).
5. **Rating** (1–5 or 1–10 scale, shows average and distribution).

Quiz is fully specified below. Poll, word cloud, rating and Q&A reuse the same screens with the differences listed in section 9.

## 4. Session state machine

The session has exactly one current state, owned by the server and broadcast to all clients. Clients render purely from this state plus their own local data.

```
draft → lobby → question_intro → question_live → question_locked → reveal → leaderboard
                     ↑                                                          │
                     └──────────────────── next question ───────────────────────┘
leaderboard (after last question) → podium → ended

Any live state can go to `paused` and back to the state it came from.
```

| State | Duration | Big screen | Phone |
|---|---|---|---|
| `lobby` | Until host starts | Join code, QR, avatars appearing, player count | "You're in" with own avatar |
| `question_intro` | 3s | Question number and text, "Get ready" countdown 3-2-1 | Question number, "Look up" prompt |
| `question_live` | Question time limit (default 20s) | Question, options, timer, answered count | Answer tiles, timer bar |
| `question_locked` | Until reveal (auto after 1.5s) | "Time's up" | "Locked in" or "Time's up" |
| `reveal` | Until host advances (auto after 5s if auto-advance is on) | Correct answer highlighted, vote distribution bars | Personal result: correct/wrong, points, streak, rank change |
| `leaderboard` | Until host advances (auto after 6s) | Top 5 with animated rank changes | Own rank and gap to the next rank |
| `podium` | Until host ends | 3rd → 2nd → 1st reveal, confetti | Final rank, badge, share card |
| `paused` | Until resumed | "Paused" overlay, timer frozen | "Host paused the game" |
| `ended` | — | Thank-you screen with host's call to action | Final summary and share card |

Rules:
- `question_live` ends early and moves to `question_locked` as soon as every connected player has answered.
- Pausing during `question_live` freezes the remaining time on the server; resuming restores it.
- Every state broadcast includes `state`, `questionId`, `questionIndex`, `totalQuestions`, and for timed states `startedAt` and `endsAt` in server time.

## 5. Participant app

Portrait phone, single column, content max width 420px. Every primary button is full width and at least 48px tall. The participant never sees a scrollbar during a live question.

### P1. Join

- Route `/join`. If opened from the QR code (`/join?code=482913`), prefill and auto-submit the code; go straight to P2.
- Layout: event or product logo (PLACEHOLDER: logo, 56px tall), heading "Enter event code", one large numeric input (6 digits, `inputmode="numeric"`, `autocomplete="one-time-code"`, letter-spaced, centered), full-width "Join" button, and a small line "Or scan the QR code on the screen".
- Validation: exactly 6 digits, otherwise inline error "Enter the 6-digit code on the screen". Unknown code: "We couldn't find that event. Check the code on the screen." Event ended: "This event has ended."
- Auto-submit when the 6th digit is typed.
- Acceptance: QR path reaches P2 with zero typing; wrong code never clears the input.

### P2. Pick your look

- Heading "Pick your look", subtext "This is how you'll appear on the big screen."
- Avatar grid of 12 options, 3 columns, 56px circles, selected avatar has an accent ring. PLACEHOLDER: use DiceBear (open-source avatar generator, e.g. the "fun-emoji" or "adventurer" styles) seeded with fixed seeds, or simple icon avatars.
- Nickname input (max 20 characters) with a dice button that fills a random fun name. Keep a list of 100+ friendly two-word names, including local flavour ("Cosmic Suya", "Jolly Jollof", "Swift Falcon").
- Profanity filter on nicknames; reject with "Pick a different name."
- Duplicate name in the same session: append a small number ("Kemi 2") silently.
- Button "I'm ready". Validation: empty name shows "Enter a nickname first".
- If the host enabled teams, show a team picker after the avatar (large team tiles with team color and member count) or auto-assign if the host chose "Auto teams".
- On submit, store a `rejoinToken` in localStorage (see 10.2).

### P3. Lobby

- Big own avatar (84px), "You're in, {name}", subtext "Look for yourself on the big screen".
- Live player count pill: "42 players joined" (updates in real time).
- Small reactions bar at the bottom (5 emoji buttons) that send reactions to the big screen, so the waiting time is fun.
- If the host hasn't started, no countdown is shown; when the host starts, go to P4 intro.
- Acceptance: the player's avatar appears on the big screen within 1 second of tapping "I'm ready".

### P4. Question intro (3s)

- "Question 3 of 10" large, and "Look up" with an arrow icon pointing up. On remote/hybrid sessions (host setting), show the full question text here instead.
- Short tick sound on each second of the 3-2-1 (if sound is on, see 11.2).

### P5. Answer (question_live)

Layout top to bottom:
1. Header row: "Question 3 of 10" (left), current score pill (right).
2. Timer bar: full width, 8px, shrinks linearly to zero, turns danger color in the last 5 seconds. Show whole seconds remaining at the right.
3. Streak indicator if streak ≥ 2: flame icon and "2 in a row".
4. Question text (hidden in "look up" mode, shown in hybrid mode).
5. Answer tiles in a 2×2 grid (or stacked if 2 options). Each tile has a distinct color AND shape icon plus the option text. Minimum tile height 84px.

Fixed tile mapping (never change between questions, players learn it):

| Slot | Shape | Color role |
|---|---|---|
| A | Triangle | Purple |
| B | Circle | Teal |
| C | Square | Coral |
| D | Diamond | Blue |

Interaction:
- Tap a tile: it scales to 0.96 on press, then locks immediately. Selected tile gets a thick accent outline; the other tiles turn neutral grey. Vibrate 30ms (`navigator.vibrate`, ignore if unsupported).
- Below the grid: "Locked in. 31 of 42 answered" (count updates live).
- No changing answers once locked (v1).
- Send the answer with the question ID and the client's local timestamp (for analytics only). The server stamps the real receive time.
- If the request is still in flight, show the locked state anyway. If it fails, retry silently up to 3 times within the grace window; if all fail, show "Couldn't send your answer. Check your connection." without unlocking.
- Timer reaches zero with no answer: show "Time's up" on the tile area.

### P6. Personal reveal

Shown when the state becomes `reveal`. This is the most important emotional moment on the phone.

Correct:
- Success-tinted card: check icon, "Correct", large "+812".
- Breakdown row: "Base 500" and "Speed bonus +312". If a streak bonus applied: "Streak bonus +100".
- Streak line: flame icon, "3 in a row".
- Rank change line: "Up 4 places. You're #2" (success color) or "Holding at #3".
- Short celebratory sound and a 2-pulse vibration.

Wrong or no answer:
- Danger-tinted card: "Not this time" or "Time's up".
- "The answer was Mars. 68% of players got it."
- Near-miss line, always framed forward: "You're #9, only 120 pts behind #8".
- If a streak was lost: "Streak reset. Start a new one next question."

Never show a rank below the halfway point as a bare number without the gap-to-next line; the goal is to keep low-ranked players motivated.

### P7. Leaderboard (phone)

- "You're #4 of 42", total score, and "140 pts behind #3".
- If in the top 5, highlight "You're on the big screen".
- Team mode: team rank and the player's contribution.

### P8. Podium and results

- While the big screen does the 3-2-1 podium reveal, the phone shows "Final results on the big screen" and then the player's own result once 1st place is revealed.
- Final card: rank, total score, correct answers "7 of 10", best streak, and one earned badge (see 8.4).
- "Share result card" generates an image (1080×1920 story format and 1080×1080 square) with avatar, name, rank, score, badge, event name, and the platform's logo and URL. Use the Web Share API with an image file; fall back to download.
- Secondary button "Join another game" goes to P1.

### P9. Edge screens

- Joined after the game started: skip the lobby, show "You joined mid-game. You'll play from the next question." and wait.
- Paused: full-screen "Host paused the game" with the frozen timer value.
- Kicked by host: "The host removed you from this game." with no rejoin.
- Session ended while away: show the final results for that player if they had played.
- Reconnecting: small top banner "Reconnecting…" that never covers the answer tiles; the rest of the UI stays usable.

## 6. Big screen

Landscape 16:9, designed at 1920×1080 and scaled with the viewport (use `vw`/`clamp()` for type). Dark and light themes; default dark for event halls. Nothing interactive is required on this screen; everything is driven by server state. The one exception is keyboard shortcuts when the host runs it from their own laptop (7.3).

### S1. Lobby

- Top: "Join at {domain}" and the code in very large letter-spaced digits ("482 913"), plus a large QR code (min 25% of screen height) that encodes `/join?code=482913`. Generate the QR client-side (e.g. the `qrcode` npm package).
- Center: avatars appear as players join, each with a small pop-in animation (scale 0.6 → 1, 250ms, slight overshoot) and their nickname underneath. When there are more than ~40, switch to a compact grid; above ~120, show a rolling wall and the total count.
- Bottom: "42 players" count and the event title.
- Emoji reactions from phones float up from the bottom and fade out (max 30 on screen at once; drop extras).
- Optional lobby music loop (host setting, off by default).

### S2. Question intro

- "Question 3 of 10" and the question text, very large, center aligned, with a 3-2-1 countdown ring.

### S3. Question live

- Top bar: small join code and QR in the corner (for latecomers), question number.
- Question text large at the top.
- Four answer tiles matching the phone's shape and color mapping, with option text.
- Circular countdown timer, drives from `endsAt` synced to server time. Last 5 seconds: ticking sound and danger color.
- Bottom: "31 of 42 answered" with a progress bar, plus avatars of the most recent players to lock in ("+28 locked in").
- Do NOT show the vote distribution during `question_live` (prevents copying).
- Optional question image or video above the tiles (PLACEHOLDER: image slot 16:9, max 40% height).

### S4. Reveal

- Wrong tiles dim; the correct tile gets a check icon and stays full color.
- Vote distribution bars grow from zero to their values over 600ms, with counts on each bar.
- Callout line: "68% got it right" and "Fastest: Kemi, 1.2s".

### S5. Leaderboard

- Top 5 rows (top 10 on very large screens): rank, avatar, name, score, movement arrow.
- Rows animate to their new positions (FLIP animation, 500ms). Score numbers count up.
- One storyline callout below, picked by priority: overtakes into 1st ("Tunde takes the lead"), longest active streak ("Kemi is on a 4-answer streak"), biggest climber ("Bola climbed 7 places").
- Team mode: show team standings instead, with team colors.

### S6. Podium

- Three pillars. Reveal order: 3rd, pause 1.5s, 2nd, pause 1.5s, drumroll, 1st.
- Winner reveal: confetti (Lottie or canvas-confetti), fanfare sound, winner avatar enlarged.
- After the reveal, show "Thanks for playing" plus the host's optional call to action (text and link/QR, set in the editor).

### S7. Paused and ended

- Paused: dim everything, large "Paused" label; timer frozen.
- Ended: final podium stays visible with the host's call to action.

## 7. Host

### 7.1 Host editor

- Session settings: title, logo upload (PLACEHOLDER until uploaded), default time limit (10/20/30/60s), scoring on/off, speed bonus on/off, teams (off / let players choose / auto-assign, number of teams), auto-advance on/off, sound on/off, "look up" vs hybrid mode, late join allowed.
- Question list with drag to reorder, duplicate, delete. Each quiz question: text (max 120 characters, show a counter), 2–4 options (max 60 characters each), mark one correct, optional image, time limit override, "double points" toggle.
- Live preview panel showing the question as it will appear on the big screen and phone.
- Import questions from a pasted list (one question per block, first line question, following lines options, `*` marks the correct option).
- Autosave with "Saved" indicator. No explicit save button.

### 7.2 Host remote (live)

A compact control panel that works on a phone or laptop.

- Header: session title, state label ("Q3 live · 31/42 answered"), connection indicator.
- One large primary button whose label always names the next step: "Start game" → "Reveal answer" → "Show leaderboard" → "Next question" → … → "Show podium" → "End game". Pressing it repeatedly runs the whole event.
- Secondary controls: Pause/Resume, "+10s", Skip question, Back to previous state (only between questions).
- Presenter notes for the current question (from the editor) and the correct answer, visible only to the host.
- Players panel: count, list with online/offline dots, kick (with confirm), rename offensive names.
- Q&A/word-cloud moderation queue when those activities are live (see 9).
- The host remote reconnects and restores fully on refresh; no host action is lost.

### 7.3 Keyboard shortcuts (big screen opened by the host)

`Space` primary action, `P` pause/resume, `S` skip, `+` add 10s, `H` toggle host overlay, `F` fullscreen hint. Show a small "?" help overlay listing them.

## 8. Scoring and gamification

All scoring runs on the server. Points are integers.

### 8.1 Question points

```
elapsed        = answer.receivedAt - question.startedAt          (server time, ms)
timeLimit      = question.timeLimitMs
grace          = 300 ms                                          (network tolerance)
accepted       = elapsed <= timeLimit + grace
effective      = clamp(elapsed - grace, 0, timeLimit)

if not accepted or answer is wrong: points = 0
base           = 500
speedBonus     = round(500 * (1 - effective / timeLimit))        (0..500, capped so accuracy always matters more)
streakBonus    = min(streakBefore, 5) * 20                       (streakBefore = consecutive correct answers before this one)
points         = (base + speedBonus + streakBonus) * (question.doublePoints ? 2 : 1)
```

Host can turn off the speed bonus (base only) for accuracy-first audiences like classrooms.

### 8.2 Streaks

- Streak = consecutive correct answers. Wrong or no answer resets to 0.
- Show on phone from streak 2. Show on big screen callouts from streak 3.

### 8.3 Comeback mechanics

- Host can mark the final question (or final round) as double points; the big screen announces it during intro: "Double points".
- Near-miss messaging on the phone (P6, P7).
- Optional lightning round: 5 questions at 10s each back to back, no leaderboard between them.

### 8.4 Badges (one shown per player at the end, highest priority first)

| Badge | Rule |
|---|---|
| Perfect game | All answers correct |
| Fastest finger | Most questions answered first among correct answers |
| On fire | Streak of 5 or more |
| Comeback kid | Climbed 10+ places from the lowest rank reached |
| Sharp shooter | 80%+ correct |
| Never give up | Answered every question (fallback so everyone gets one) |

### 8.5 Teams

- Team score = average of members' scores (rounded), so bigger teams don't win automatically.
- Team colors are separate from answer tile colors to avoid confusion.

### 8.6 Tie-breaking

Same score: faster total answer time on correct answers ranks higher. Still tied: earlier join time.

## 9. Other activity types

These reuse the session shell and state machine, without `leaderboard`/`podium` unless mixed into a quiz.

**Live poll.** Phone: same tiles as the quiz but no correct answer and no score; after voting show "Vote sent" and, if the host set results to "live", a small live results bar chart. Big screen: bars update live as votes arrive (throttle to 4 updates per second), or only on reveal if the host chose "hide until reveal". Optional multi-select (max choices set by host).

**Word cloud.** Phone: single text input (max 25 characters) with "Send", up to 3 entries per player (host setting); show the player's sent words as chips. Big screen: words sized by frequency, normalized case and trimmed, new words fade in, most frequent word in accent color. Profanity filter; host can hide any word from the remote.

**Rating.** Phone: large 1–5 stars or 1–10 number buttons. Big screen: average in huge type plus distribution bars.

**Q&A.** Phone: text box (max 160 characters), "Ask anonymously" toggle, list of questions sorted by upvotes with an upvote button (one per player per question, can undo). Host remote: moderation queue (approve, dismiss, mark answered, highlight). Big screen: the highlighted question full screen with the asker's name (or "Anonymous") and upvote count; otherwise a top-5 list.

## 10. Real-time model and resilience

### 10.1 Transport

- The frontend talks to the backend only through a `RealtimeAdapter` interface so the provider can be swapped. The first implementation uses Supabase (Realtime broadcast for state and events, Presence for who's online, Postgres for persistence, a Postgres function/RPC for submitting answers and computing scores atomically).

```ts
interface RealtimeAdapter {
  joinSession(code: string, profile: PlayerProfile): Promise<JoinResult>;   // returns player + rejoinToken
  rejoin(token: string): Promise<JoinResult | null>;
  subscribe(sessionId: string, handlers: SessionHandlers): Unsubscribe;
  submitAnswer(input: { questionId: string; optionId: string; clientTs: number }): Promise<AnswerAck>;
  sendReaction(emoji: string): void;
  hostCommand(cmd: HostCommand): Promise<void>;   // start, reveal, next, pause, resume, addTime, skip, kick
  serverTimeOffset(): number;                     // ms, for countdown sync
}
```

### 10.2 Events (server → clients)

| Event | Payload | Audience |
|---|---|---|
| `session.state` | state, questionId, questionIndex, totalQuestions, startedAt, endsAt, pausedRemainingMs | All |
| `lobby.players` | count, recent joins (id, name, avatar) | Big screen, host, players (count only) |
| `question.progress` | answeredCount, connectedCount, recent lock-ins | All (throttled to 4/s) |
| `question.reveal` | correctOptionId, distribution, fastestPlayer | All |
| `player.result` | correct, points, breakdown, streak, rank, rankDelta, gapToNext | That player only |
| `leaderboard` | top N, callout | All |
| `reaction` | emoji | Big screen |

Never send the correct answer to participant clients before `reveal`.

### 10.3 Time sync

On join, estimate the server clock offset (median of 3 round trips). All countdowns render from `endsAt - (Date.now() + offset)`. The timer display is cosmetic; acceptance is decided by the server.

### 10.4 Reconnect and rejoin

- Store `rejoinToken` and `sessionId` in localStorage (wrap in try/catch; if storage is unavailable, keep them in memory).
- On reload or reconnect, call `rejoin(token)` and render the current `session.state` immediately. The player keeps name, avatar, score and streak.
- Exponential backoff reconnect (1s, 2s, 4s, max 10s). Show the "Reconnecting…" banner after 1.5s of disconnection, not before.
- The host remote uses the same mechanism; host commands are idempotent (each carries a command ID).

### 10.5 Weak network behaviour

- Keep payloads small (IDs and numbers, no repeated text). Question text is fetched once per session at start and cached.
- Preload the next question's image during the leaderboard.
- Optimistic UI for answers, reactions and upvotes.
- The phone bundle for the participant routes should stay small (target under 150 KB gzipped JS); lazy-load the host and editor code.

## 11. Visual design, motion and sound

### 11.1 Visual direction (proposal, override with brand if one exists)

The subject is a night of friendly competition: game nights, office parties, church and school events. The feel is a stage show, not a SaaS dashboard.

- Big screen background (dark theme): deep indigo `#1C1A4A`. Light theme: warm white `#FFFBF4`.
- Answer tiles: purple `#6A4BDB` (triangle), teal `#0E9A83` (circle), coral `#E0552D` (square), blue `#2A78E4` (diamond). White text on all four.
- Celebration accent (streaks, podium, badges): marigold `#F2B230`, used sparingly.
- Success `#1F9D55`, danger `#D93B3B` for correct/wrong states.
- Type: one expressive grotesque family for everything, e.g. Bricolage Grotesque (Google Fonts) at heavy weight for question text and scores, regular for body, with a system-sans fallback. Use tabular numerals for scores, timers and codes so digits don't jiggle while counting.
- Spend the boldness on the question text and the reveal moment; keep chrome (headers, pills, controls) quiet.
- Layout: phone screens center-aligned during emotional moments (join, lobby, reveal, podium), left-aligned for lists (Q&A, leaderboard).

### 11.2 Motion

- Response motion (taps, locks, reveals): 120–300ms, ease-out.
- One orchestrated moment per phase: avatar pop-in in the lobby, bar growth on reveal, row reordering on the leaderboard, the podium sequence. No decorative animations elsewhere.
- Respect `prefers-reduced-motion`: replace movement with fades and skip confetti.

### 11.3 Sound (big screen only by default; phones silent unless the player enables it)

Lobby loop (optional), 3-2-1 tick, last-5-seconds tick, reveal sting, leaderboard whoosh, podium drumroll and fanfare. Host can mute from the remote. PLACEHOLDER: royalty-free sound files; keep each under 50 KB.

### 11.4 Haptics

`navigator.vibrate` on lock-in (30ms) and on correct reveal (2 × 40ms). Feature-detect; iOS Safari ignores it, so visual feedback must stand on its own.

## 12. Accessibility

- Every answer option is identified by shape and text, never color alone.
- Tap targets at least 48×48px; answer tiles much larger.
- Contrast: text meets WCAG AA on all backgrounds, including white on tile colors.
- Screen reader: announce state changes with a polite live region on the phone ("Question 3 of 10", "Correct, plus 812 points"). Answer tiles are real buttons with accessible names ("Option B, circle, Mars").
- Visible keyboard focus on host screens.
- Support system dark mode on the phone; big screen theme is a host setting.

## 13. Copy guidelines

- Sentence case everywhere. Contractions. Plain verbs.
- Buttons name the action and keep the same name through the flow ("Reveal answer" leads to a revealed answer, not "Submit").
- Errors say what happened and what to do, with no apology and no "Error:" prefix.
- Wrong-answer and low-rank messaging always points forward ("Start a new one next question").
- Never shame players publicly: the big screen only shows top ranks and positive callouts.

## 14. Assets and placeholders

| Slot | v1 placeholder | Final |
|---|---|---|
| Product/event logo | Dashed box labelled "Logo" | Host upload (PNG/SVG, max 1 MB) |
| Avatars | Icon avatars or DiceBear seeded set | Custom illustrated set |
| Question image | Grey 16:9 box with image icon | Host upload |
| Confetti and podium effects | canvas-confetti | Custom Lottie animations |
| Sounds | Silent stubs with the same API | Licensed sound pack |
| Share card background | Solid theme color | Designed template |

Every placeholder must be clearly marked in code (`// PLACEHOLDER:`) and swappable through config.

## 15. Acceptance checklist

- [ ] QR scan to lobby in under 10 seconds with zero typing.
- [ ] Manual code entry auto-submits on the 6th digit; invalid codes show specific errors.
- [ ] Player's avatar appears on the big screen within 1 second of joining.
- [ ] Answer tap shows the locked state within 100ms, even with network throttled to "Slow 3G".
- [ ] Killing and reopening the browser mid-question restores the player with score and streak intact.
- [ ] Correct answer is never present in participant payloads before reveal.
- [ ] Scores match the formula in 8.1 when computed from server timestamps; the client clock has no effect.
- [ ] `question_live` ends early when all connected players have answered.
- [ ] Pause freezes the timer on every device and resume restores the exact remaining time.
- [ ] Leaderboard rows animate to new positions; podium reveals 3rd, 2nd, then 1st.
- [ ] Every player gets a badge and a shareable result card.
- [ ] Host can run the full quiz using only the primary button.
- [ ] Host remote survives refresh with no lost state.
- [ ] Reduced-motion setting removes movement and confetti.
- [ ] All screens pass WCAG AA contrast and work with a screen reader on the phone.
- [ ] Realtime access goes only through `RealtimeAdapter`; no provider SDK calls in UI components.