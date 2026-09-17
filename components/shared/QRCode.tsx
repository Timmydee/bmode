"use client";

import { QRCodeSVG } from "qrcode.react";

interface QRCodeProps {
  url: string;
  size?: number;
}

export default function QRCode({ url, size = 160 }: QRCodeProps) {
  return (
    <div className="inline-flex rounded-xl bg-white p-3">
      <QRCodeSVG value={url} size={size} bgColor="#ffffff" fgColor="#14121F" />
    </div>
  );
}
