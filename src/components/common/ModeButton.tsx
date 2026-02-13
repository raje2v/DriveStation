interface ModeButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

export default function ModeButton({ label, selected, onClick }: ModeButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
        selected
          ? "bg-ds-accent text-white"
          : "bg-ds-panel text-ds-text-dim hover:bg-ds-border"
      }`}
    >
      <div
        className={`w-3 h-3 rounded-full border-2 ${
          selected ? "border-white bg-white" : "border-ds-text-dim"
        }`}
      >
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-ds-accent mx-auto mt-[1px]" />}
      </div>
      {label}
    </button>
  );
}
