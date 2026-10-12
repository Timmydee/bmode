import type { IconName } from "@/components/shared/Icon";
import Icon from "@/components/shared/Icon";
import { cardStockStyle } from "@/lib/cards/card-stock";
import type { CardCategory, CardCategoryId } from "@/lib/cards/library";

// Each category's icon and colour on the indigo page (tabs, chips), in the
// same hue as its card stock in lib/cards/card-stock.ts.
export const CATEGORY_STYLES: Record<CardCategoryId, { icon: IconName; chip: string; text: string }> = {
  icebreakers: { icon: "snowflake", chip: "bg-[#2F5BE0]/25 text-[#93B0FF]", text: "text-[#93B0FF]" },
  relationships: { icon: "heart", chip: "bg-[#D02A6C]/20 text-[#FF8DBC]", text: "text-[#FF8DBC]" },
  friendships: { icon: "users", chip: "bg-[#C94D16]/25 text-[#FFAE7F]", text: "text-[#FFAE7F]" },
  deep: { icon: "moon", chip: "bg-[#0F6273]/35 text-[#6CD3E2]", text: "text-[#6CD3E2]" },
  fun: { icon: "flame", chip: "bg-[#7A3BE6]/25 text-[#C2A4FF]", text: "text-[#C2A4FF]" },
};

// A question card from the library, printed on its category's stock: the
// question in heavy type, the category icon large and faint in the corner,
// the Bmode mark and the category name along the bottom. The Circle game's
// QuestionCard uses the same stock, labelled by depth instead.
export default function CardFace({
  text,
  category,
  size = "md",
  className = "",
}: {
  text: string;
  category: CardCategory;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const style = CATEGORY_STYLES[category.id];
  const pad = size === "lg" ? "min-h-72 gap-10 p-7 sm:p-10" : size === "md" ? "min-h-56 gap-8 p-6" : "min-h-44 gap-5 p-5";
  const mark =
    size === "lg" ? "-right-10 -bottom-10 h-64 w-64" : size === "md" ? "-right-8 -bottom-8 h-48 w-48" : "-right-6 -bottom-6 h-36 w-36";
  const type =
    size === "lg"
      ? "text-[1.9rem] leading-[1.12] sm:text-[2.5rem]"
      : size === "md"
        ? "text-[1.6rem] leading-[1.15]"
        : "text-[1.2rem] leading-[1.18]";
  return (
    <div
      style={cardStockStyle(category.id)}
      className={`relative isolate flex flex-col justify-between overflow-hidden rounded-2xl text-white shadow-[0_12px_32px_rgb(0_0_0/45%)] ring-1 ring-white/20 ${pad} ${className}`}
    >
      <Icon name={style.icon} className={`pointer-events-none absolute -z-10 text-white/[0.07] ${mark}`} />
      <p className={`font-card font-extrabold tracking-tight text-balance ${type}`}>{text}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 font-card text-[11px] font-extrabold tracking-tight text-white/80">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] bg-white/80" />
          Bmode
        </span>
        <span className="flex items-center gap-1.5 font-card text-[11px] font-bold tracking-wide text-white/85 uppercase">
          <Icon name={style.icon} className="h-3.5 w-3.5" />
          {category.name}
        </span>
      </div>
    </div>
  );
}
