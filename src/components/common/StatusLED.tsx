interface StatusLEDProps {
  active: boolean;
  color?: "green" | "red" | "orange";
  label: string;
}

export default function StatusLED({ active, color = "green", label }: StatusLEDProps) {
  const colors = {
    green: active ? "bg-ds-green shadow-[0_0_6px_var(--color-ds-green)]" : "bg-gray-600",
    red: active ? "bg-ds-red shadow-[0_0_6px_var(--color-ds-red)]" : "bg-gray-600",
    orange: active ? "bg-ds-orange shadow-[0_0_6px_var(--color-ds-orange)]" : "bg-gray-600",
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 rounded-full ${colors[color]} transition-colors`} />
      <span className="text-xs text-ds-text-dim">{label}</span>
    </div>
  );
}
