export default function BetaBadge({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-[3px] border-2 px-1.5 py-0.5 text-[10px] font-bold leading-none tracking-wide ${onDark ? "border-white bg-transparent text-white" : "border-black bg-white text-black"}`}>
      BETA
    </span>
  );
}
