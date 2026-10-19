import type { Metadata } from "next";
import { connection } from "next/server";
import { adminPasswordConfigured, isAdmin } from "@/lib/admin-auth";
import { adminInsights } from "@/lib/backend/admin";
import type { EmailSignup, Feedback, InsightsDay, InsightsSummary } from "@/lib/backend";
import Icon from "@/components/shared/Icon";
import { signIn, signOut } from "./actions";

export const metadata: Metadata = {
  title: { absolute: "Bmode admin" },
  robots: { index: false, follow: false },
};

const panel = "rounded-2xl border border-stage-line bg-stage-2";

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  // Always render per request: the env and the numbers are read live.
  await connection();
  if (!adminPasswordConfigured()) {
    return (
      <Shell>
        <Notice title="Admin is not set up yet">
          Add an <Code>ADMIN_PASSWORD</Code> environment variable (and{" "}
          <Code>SUPABASE_SERVICE_ROLE_KEY</Code>) in Vercel, then redeploy.
        </Notice>
      </Shell>
    );
  }

  if (!(await isAdmin())) {
    const { error } = await searchParams;
    return (
      <Shell>
        <form action={signIn} className={`${panel} mx-auto flex w-full max-w-sm flex-col gap-4 p-6`}>
          <h1 className="font-display text-2xl font-bold">Bmode admin</h1>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium text-stage-text">Password</span>
            <input
              type="password"
              name="password"
              required
              autoFocus
              autoComplete="current-password"
              className="rounded-[10px] border-[1.5px] border-stage-line bg-rail px-4 py-3 text-white outline-none focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
            />
          </label>
          {error && <p className="text-sm text-ember">That password didn&apos;t match.</p>}
          <button
            type="submit"
            className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink transition-colors hover:bg-spotlight-hover"
          >
            Sign in
          </button>
        </form>
      </Shell>
    );
  }

  let summary: InsightsSummary;
  let feedback: Feedback[];
  try {
    [summary, feedback] = await Promise.all([
      adminInsights.summary(),
      adminInsights.listFeedback(100),
    ]);
  } catch (error) {
    return (
      <Shell signedIn>
        <Notice title="Couldn't load the numbers">
          {error instanceof Error ? error.message : String(error)}. Check that
          migration <Code>0009_insights.sql</Code> is applied and{" "}
          <Code>SUPABASE_SERVICE_ROLE_KEY</Code> is set.
        </Notice>
      </Shell>
    );
  }

  return (
    <Shell signedIn>
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="People today" value={summary.peopleToday} />
        <Stat label="People, last 7 days" value={summary.people7d} />
        <Stat label="People, last 30 days" value={summary.people30d} />
        <Stat label="People, all time" value={summary.peopleAll} />
        <Stat label="Games hosted, 7 days" value={summary.games7d} detail={`${summary.gamesAll} all time`} />
        <Stat label="Players joined, 7 days" value={summary.joins7d} detail={`${summary.joinsAll} all time`} />
        <Stat label="Circles finished" value={summary.circlesFinishedAll} detail="all time" />
        <Stat
          label="Average rating"
          value={summary.ratingAvg ?? "None yet"}
          detail={`${summary.feedbackAll} feedback ${summary.feedbackAll === 1 ? "note" : "notes"}`}
        />
      </section>
      <p className="text-xs text-stage-muted">
        People are distinct browsers, counted{" "}
        {summary.trackingSince
          ? `since ${formatDate(summary.trackingSince)}`
          : "from the first visit after this shipped"}
        . Games and joins include everything before that.
      </p>

      <DailyChart days={summary.daily} />

      <EmailSignupsPanel />

      <section className={`${panel} p-5`}>
        <h2 className="font-display text-lg font-bold">Feedback</h2>
        {feedback.length === 0 ? (
          <p className="mt-3 text-sm text-stage-muted">No feedback yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stage-line">
            {feedback.map((item) => (
              <FeedbackItem key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

function Shell({ children, signedIn = false }: { children: React.ReactNode; signedIn?: boolean }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-8 md:px-6">
      {signedIn && (
        <header className="flex items-center justify-between gap-4">
          <h1 className="font-display text-2xl font-bold">Bmode admin</h1>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-[10px] border-[1.5px] border-white/30 px-3 py-1.5 text-sm font-medium text-white"
            >
              Sign out
            </button>
          </form>
        </header>
      )}
      {children}
    </main>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={`${panel} mx-auto w-full max-w-lg p-6`}>
      <h1 className="font-display text-xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-stage-text">{children}</p>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-rail px-1.5 py-0.5 text-xs text-white">{children}</code>;
}

function Stat({ label, value, detail }: { label: string; value: number | string; detail?: string }) {
  return (
    <div className={`${panel} flex flex-col gap-1 p-4`}>
      <span className="text-xs font-medium text-stage-muted">{label}</span>
      <span className="font-display text-3xl font-bold tabular-nums">{value}</span>
      {detail && <span className="text-xs text-stage-muted">{detail}</span>}
    </div>
  );
}

// Single series (people per day), so no legend: the title names it. Each
// bar's tooltip carries that day's games and joins too, and the table
// below the chart has every value for anyone who can't hover.
function DailyChart({ days }: { days: InsightsDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.people));
  return (
    <section className={`${panel} p-5`}>
      <h2 className="font-display text-lg font-bold">People per day</h2>
      <p className="text-xs text-stage-muted">Last 30 days. Hover a bar for games and joins.</p>
      <div className="relative mt-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-stage-line" />
        <span className="absolute -top-2.5 right-0 bg-stage-2 pl-1 text-[10px] text-stage-muted tabular-nums">{max}</span>
        <div className="flex h-40 items-end gap-0.5 border-b border-stage-line">
          {days.map((d, i) => (
            <div key={d.day} className="group relative flex h-full flex-1 items-end justify-center hover:bg-stage-hover/50">
              <div
                className="w-full max-w-4 rounded-t bg-blurple"
                style={{ height: `${(d.people / max) * 100}%`, minHeight: d.people ? 2 : 0 }}
              />
              <div className={`pointer-events-none absolute bottom-full z-10 mb-2 hidden whitespace-nowrap ${tooltipSide(i, days.length)} rounded-lg border border-stage-line bg-floating px-3 py-2 text-xs shadow-lg group-hover:block`}>
                <p className="font-semibold text-white">{formatDay(d.day)}</p>
                <p className="text-stage-text">{plural(d.people, "person", "people")}</p>
                <p className="text-stage-muted">
                  {plural(d.games, "game", "games")}, {plural(d.joins, "join", "joins")}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-stage-muted">
          <span>{days[0] && formatDay(days[0].day)}</span>
          <span>Today</span>
        </div>
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer text-stage-muted hover:text-white">Show as a table</summary>
        <table className="mt-3 w-full text-left tabular-nums">
          <thead className="text-xs text-stage-muted">
            <tr>
              <th className="py-1 font-medium">Day</th>
              <th className="py-1 text-right font-medium">People</th>
              <th className="py-1 text-right font-medium">Games</th>
              <th className="py-1 text-right font-medium">Joins</th>
            </tr>
          </thead>
          <tbody className="text-stage-text">
            {[...days].reverse().map((d) => (
              <tr key={d.day} className="border-t border-stage-line">
                <td className="py-1">{formatDay(d.day)}</td>
                <td className="py-1 text-right">{d.people}</td>
                <td className="py-1 text-right">{d.games}</td>
                <td className="py-1 text-right">{d.joins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

const SIGNUP_SOURCES: Record<EmailSignup["source"], string> = {
  host_recap: "Host, after a game",
  cards: "Question cards page",
};

// Loaded on its own so the rest of the page still works before migration
// 0010 is applied.
async function EmailSignupsPanel() {
  let signups: EmailSignup[];
  try {
    signups = await adminInsights.listEmailSignups();
  } catch (error) {
    return (
      <section className={`${panel} p-5`}>
        <h2 className="font-display text-lg font-bold">Email signups</h2>
        <p className="mt-3 text-sm text-stage-muted">
          Couldn&apos;t load signups ({error instanceof Error ? error.message : String(error)}). Apply
          migration <Code>0010_email_signups.sql</Code> in Supabase.
        </p>
      </section>
    );
  }
  const bySource = (source: EmailSignup["source"]) => signups.filter((s) => s.source === source).length;
  return (
    <section className={`${panel} p-5`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold">Email signups</h2>
        <p className="text-sm text-stage-muted">
          {plural(signups.length, "person", "people")} · {bySource("host_recap")} hosts ·{" "}
          {bySource("cards")} from the cards page
        </p>
      </div>
      {signups.length === 0 ? (
        <p className="mt-3 text-sm text-stage-muted">No signups yet.</p>
      ) : (
        <>
          <label className="mt-4 flex flex-col gap-1.5 text-xs text-stage-muted">
            Every address, ready to paste into your email tool
            <textarea
              readOnly
              rows={3}
              value={signups.map((s) => s.email).join(", ")}
              className="rounded-[10px] border-[1.5px] border-stage-line bg-rail px-3 py-2 font-mono text-xs text-white"
            />
          </label>
          <ul className="mt-3 divide-y divide-stage-line text-sm">
            {signups.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                <a href={`mailto:${s.email}`} className="text-blurple-soft hover:underline">
                  {s.email}
                </a>
                <span className="text-xs text-stage-muted">
                  {SIGNUP_SOURCES[s.source]} · {formatDate(s.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function FeedbackItem({ item }: { item: Feedback }) {
  return (
    <li className="flex flex-col gap-1.5 py-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stage-muted">
        {item.rating !== null && (
          <span className="flex items-center gap-0.5 text-gold" aria-label={`${item.rating} of 5`}>
            {Array.from({ length: 5 }, (_, i) => (
              <Icon key={i} name="star" filled={i < item.rating!} className="h-3.5 w-3.5" />
            ))}
          </span>
        )}
        <span>{formatDate(item.createdAt)}</span>
        {item.page && <span className="rounded bg-rail px-1.5 py-0.5">{item.page}</span>}
        {item.email && (
          <a href={`mailto:${item.email}`} className="text-blurple-soft hover:underline">
            {item.email}
          </a>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm text-white">{item.message}</p>
    </li>
  );
}

// Keep the tooltip inside the panel at both ends of the chart.
function tooltipSide(index: number, count: number): string {
  if (index < 4) return "left-0";
  if (index >= count - 4) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}
