"use client";

import { openFeedback } from "@/components/shared/FeedbackButton";
import Icon from "@/components/shared/Icon";

// The landing page's "we're in beta" line; the link opens the same feedback
// form as the corner pill.
export default function BetaNote() {
  return (
    <p className="mt-6 flex items-center gap-2 text-sm text-ink-soft">
      <Icon name="sparkle" className="h-4 w-4 shrink-0 text-spotlight" />
      <span>
        Bmode is in beta.{" "}
        <button
          type="button"
          onClick={openFeedback}
          className="font-medium text-ink underline decoration-ink-soft/60 underline-offset-4 transition-colors hover:decoration-ink"
        >
          Tell us what you think
        </button>
      </span>
    </p>
  );
}
