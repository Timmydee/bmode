interface JoinCodeProps {
  code: string;
  className?: string;
}

export default function JoinCode({ code, className }: JoinCodeProps) {
  const formatted = code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;

  return (
    <span
      className={`font-display font-semibold tracking-[0.08em] ${className ?? ""}`}
    >
      {formatted}
    </span>
  );
}
