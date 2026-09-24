"use client";

import { QRCodeSVG } from "qrcode.react";

// Matches the `stage` token in tailwind.config.ts. Kept as a literal
// (not a Tailwind class) because qrcode.react's fgColor prop needs a raw
// CSS color value, not a class name — but defined once, here, rather than
// duplicated at each call site.
const STAGE_HEX = "#14121F";

interface QRCodeProps {
  url: string;
  size?: number;
  className?: string;
}

export default function QRCode({ url, size = 160, className }: QRCodeProps) {
  return (
    <div className={`inline-flex rounded-xl bg-white p-3 ${className ?? ""}`}>
      <QRCodeSVG value={url} size={size} bgColor="#ffffff" fgColor={STAGE_HEX} />
    </div>
  );
}
