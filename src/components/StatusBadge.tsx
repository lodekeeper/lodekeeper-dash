interface Props {
  status: "idle" | "working" | "busy";
  className?: string;
}

const COLORS = {
  idle: "bg-status-idle",
  working: "bg-status-working",
  busy: "bg-status-busy",
};

export function StatusBadge({ status, className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      <span className={`w-2 h-2 rounded-full ${COLORS[status]} animate-pulse`} />
      <span className="capitalize text-gray-300">{status}</span>
    </span>
  );
}
