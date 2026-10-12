"use client";

import { useCallback, useEffect, useState } from "react";
import Icon from "@/components/shared/Icon";

// A short message that floats in at the top of the screen ("Link copied").
export function useToast(): [string | null, (message: string | null) => void] {
  const [toast, setToast] = useState<{ message: string; at: number } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);
  const show = useCallback((message: string | null) => {
    if (message) setToast({ message, at: Date.now() });
  }, []);
  return [toast?.message ?? null, show];
}

export default function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="status" className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <p className="flex animate-toast-in items-center gap-2 rounded-lg border-l-4 border-live bg-floating px-4 py-2.5 text-sm font-semibold text-ink shadow-[0_8px_24px_rgb(0_0_0/50%)]">
        <Icon name="check" className="h-4 w-4 text-live" />
        {message}
      </p>
    </div>
  );
}
