"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { backend } from "@/lib/backend";
import { getDeviceId } from "@/lib/identity/device-id";
import { trackDailyVisit } from "@/lib/insights";
import FeedbackButton from "@/components/shared/FeedbackButton";

// Mounted once in the root layout: counts each browser once a day and puts
// the feedback button on every screen. The admin page does neither, and the
// projector view (it faces the room) gets no button.
export default function InsightsLayer() {
  const pathname = usePathname();

  const isAdmin = pathname.startsWith("/admin");

  useEffect(() => {
    if (!isAdmin) trackDailyVisit();
  }, [isAdmin]);

  if (isAdmin || pathname.endsWith("/present")) {
    return null;
  }

  const hostSessionId = pathname.match(/^\/host\/([0-9a-f-]{36})/)?.[1] ?? null;

  return (
    <FeedbackButton
      onSubmit={(feedback) =>
        backend.insights.sendFeedback({
          ...feedback,
          deviceId: getDeviceId(),
          page: pathname,
          sessionId: hostSessionId,
        })
      }
    />
  );
}
