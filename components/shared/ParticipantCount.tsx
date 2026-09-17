interface ParticipantCountProps {
  count: number;
  variant?: "stage" | "paper";
}

export default function ParticipantCount({
  count,
  variant = "stage",
}: ParticipantCountProps) {
  const label = count === 1 ? "participant" : "participants";

  if (variant === "paper") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-spotlight/20 px-3 py-1 text-sm font-medium text-spotlight-ink">
        {count} joined
      </span>
    );
  }

  return (
    <div className="text-sm text-stage-muted">
      <b className="font-display font-semibold text-white">{count}</b>{" "}
      {label}
    </div>
  );
}
