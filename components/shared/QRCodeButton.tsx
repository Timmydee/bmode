"use client";

import { useRef } from "react";
import QRCode from "@/components/shared/QRCode";
import JoinCode from "@/components/shared/JoinCode";

// A "QR code" button that opens the join QR in a modal, so it's there for
// the room to scan without taking space from the host's controls. A native
// <dialog> gives focus trapping, Escape to close and the backdrop for free.
export default function QRCodeButton({ url, code }: { url: string; code: string }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-[10px] border-[1.5px] border-white/30 px-3 py-1.5 text-sm font-medium whitespace-nowrap text-white"
      >
        QR code
      </button>
      <dialog
        ref={dialog}
        aria-label="Join QR code"
        // Closes on a click outside the panel (the dialog element itself is
        // the backdrop-sized target; the panel inside stops being it).
        onClick={(event) => {
          if (event.target === dialog.current) dialog.current?.close();
        }}
        className="m-auto w-[min(92vw,26rem)] rounded-2xl border border-stage-line bg-stage-2 p-0 text-white shadow-[0_24px_64px_rgb(0_0_0/60%)] backdrop:bg-black/70"
      >
        <div className="flex flex-col items-center gap-5 p-8 text-center">
          <p className="font-display text-xl font-bold">Scan to join</p>
          {url && <QRCode url={url} size={240} />}
          <p className="text-sm text-stage-muted">
            or go to the site and enter
            <JoinCode code={code} className="ml-1.5 text-white" copyable />
          </p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-[10px] bg-stage-button px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-stage-button-hover"
          >
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}
