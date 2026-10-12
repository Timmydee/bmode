import type { IconName } from "@/components/shared/Icon";
import Icon from "@/components/shared/Icon";
import type { CardCategory, CardCategoryId } from "@/lib/cards/library";

// Each category's icon and colour, used on its tab, its cards and its pages.
export const CATEGORY_STYLES: Record<CardCategoryId, { icon: IconName; chip: string; text: string }> = {
  icebreakers: { icon: "snowflake", chip: "bg-blurple/20 text-blurple-soft", text: "text-blurple-soft" },
  relationships: { icon: "heart", chip: "bg-fuchsia/15 text-fuchsia", text: "text-fuchsia" },
  friendships: { icon: "users", chip: "bg-gold/15 text-gold", text: "text-gold" },
  deep: { icon: "moon", chip: "bg-ember/15 text-ember", text: "text-ember" },
  fun: { icon: "flame", chip: "bg-live/15 text-live", text: "text-live" },
};

// A black question card from the library: the question in heavy type, the
// Bmode mark and the card's category along the bottom. Same stock as the
// Circle game's QuestionCard, labelled by category instead of depth.
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
  const type =
    size === "lg"
      ? "text-[1.9rem] leading-[1.12] sm:text-[2.5rem]"
      : size === "md"
        ? "text-[1.6rem] leading-[1.15]"
        : "text-[1.2rem] leading-[1.18]";
  return (
    <div
      className={`flex flex-col justify-between rounded-2xl bg-card-black text-white shadow-[0_12px_32px_rgb(0_0_0/45%)] ring-1 ring-white/15 ${pad} ${className}`}
    >
      <p className={`font-card font-extrabold tracking-tight text-balance ${type}`}>{text}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 font-card text-[11px] font-extrabold tracking-tight text-white/70">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rotate-45 rounded-[2px] bg-white/70" />
          Bmode
        </span>
        <span className={`flex items-center gap-1.5 font-card text-[11px] font-bold tracking-wide uppercase ${style.text}`}>
          <Icon name={style.icon} className="h-3.5 w-3.5" />
          {category.name}
        </span>
      </div>
    </div>
  );
}
