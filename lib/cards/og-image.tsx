import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { CARD_STOCK } from "./card-stock";
import type { CardCategoryId } from "./library";

// Link previews for card pages and shared collections: the question card
// itself, on its category's stock, on the deep indigo background, so a
// shared link looks like the card it opens. The page colour is a token
// from tailwind.config.ts; card colours come from card-stock.ts.
export const OG_SIZE = { width: 1200, height: 630 };

const STAGE = "#14152B";
const CARD_INK = "rgba(255,255,255,0.85)";

// Previews use the stock's gradient without the pattern layer, which the
// image renderer doesn't draw reliably.
function stockBackground(id: CardCategoryId): string {
  const stock = CARD_STOCK[id];
  return `linear-gradient(135deg, ${stock.light}, ${stock.dark})`;
}

const font = readFile(join(process.cwd(), "assets/fonts/InterTight-ExtraBold.ttf"));

function textSize(text: string): number {
  if (text.length <= 45) return 66;
  if (text.length <= 75) return 58;
  if (text.length <= 100) return 50;
  return 44;
}

export async function renderCardImage(input: {
  text: string;
  label: string; // bottom-right of the card: the category, or "Collection"
  stock: CardCategoryId;
  more?: number; // further cards in a collection
  behind?: CardCategoryId[]; // stock of the next cards, peeking out underneath
}): Promise<ImageResponse> {
  const stacked = input.more ? Math.min(input.more, 2) : 0;
  const behind = input.behind ?? [];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: STAGE,
          fontFamily: "Inter Tight",
          position: "relative",
        }}
      >
        {stacked >= 2 && (
          <div
            style={{
              position: "absolute",
              width: 820,
              height: 470,
              borderRadius: 32,
              backgroundImage: stockBackground(behind[1] ?? input.stock),
              border: "2px solid rgba(255,255,255,0.2)",
              opacity: 0.7,
              transform: "translate(34px, 26px) rotate(5deg)",
            }}
          />
        )}
        {stacked >= 1 && (
          <div
            style={{
              position: "absolute",
              width: 820,
              height: 470,
              borderRadius: 32,
              backgroundImage: stockBackground(behind[0] ?? input.stock),
              border: "2px solid rgba(255,255,255,0.2)",
              opacity: 0.85,
              transform: "translate(-18px, 14px) rotate(-3deg)",
            }}
          />
        )}
        <div
          style={{
            width: 820,
            height: 470,
            borderRadius: 32,
            backgroundImage: stockBackground(input.stock),
            border: "2px solid rgba(255,255,255,0.2)",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
            padding: "56px 60px 44px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            color: "white",
            transform: stacked ? "rotate(-1deg)" : "rotate(0deg)",
          }}
        >
          <div style={{ display: "flex", fontSize: textSize(input.text), lineHeight: 1.1, letterSpacing: -1.5 }}>
            {input.text}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, color: CARD_INK }}>
              <div style={{ width: 20, height: 20, background: CARD_INK, borderRadius: 4, transform: "rotate(45deg)" }} />
              Bmode
            </div>
            <div style={{ display: "flex", color: CARD_INK, textTransform: "uppercase", letterSpacing: 2, fontSize: 20 }}>
              {input.more ? `+${input.more} more ${input.more === 1 ? "question" : "questions"}` : input.label}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [{ name: "Inter Tight", data: await font, style: "normal", weight: 800 }],
    },
  );
}
