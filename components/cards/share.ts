"use client";

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

// Shares a Bmode link with the phone's share sheet when there is one, and
// copies it to the clipboard otherwise.
export async function shareLink(input: { title: string; text: string; path: string }): Promise<ShareResult> {
  const url = new URL(input.path, window.location.origin).toString();
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: input.title, text: input.text, url });
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";
      // Fall through to copying (some browsers refuse share outside https).
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

export function shareMessage(result: ShareResult): string | null {
  if (result === "copied") return "Link copied";
  if (result === "failed") return "Couldn't share that link here.";
  return null;
}
