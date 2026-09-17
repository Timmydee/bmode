"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code your host is showing.");
      return;
    }
    router.push(`/join/${code}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-20">
      <h1 className="mb-2 font-display text-3xl font-semibold text-ink">
        Join a session
      </h1>
      <p className="mb-8 text-ink-soft">
        Enter the six-digit code your host is showing on screen.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          value={code}
          onChange={(event) => {
            setError(null);
            setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
          }}
          inputMode="numeric"
          autoFocus
          placeholder="482 731"
          aria-label="Six-digit join code"
          className="rounded-[10px] border-[1.5px] border-hairline bg-paper px-4 py-3 text-center font-display text-2xl font-semibold tracking-[0.08em] text-ink outline-none focus-visible:border-spotlight focus-visible:ring-2 focus-visible:ring-spotlight/40"
        />
        {error && <p className="text-sm text-ember">{error}</p>}
        <button
          type="submit"
          className="rounded-[10px] bg-spotlight px-5 py-2.75 font-medium text-spotlight-ink"
        >
          Continue
        </button>
      </form>
    </div>
  );
}
