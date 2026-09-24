interface PcChecklistProps {
  label: string;
  pcs: string[];
  selected: string[];
  onToggle: (pc: string) => void;
  onAll: () => void;
  onClear: () => void;
}

export default function PcChecklist({
  label,
  pcs,
  selected,
  onToggle,
  onAll,
  onClear,
}: PcChecklistProps) {
  if (!pcs.length) {
    return (
      <div>
        <p className="text-sm font-medium text-navy-800 mb-1">{label}</p>
        <p className="text-xs text-muted-foreground">No PCs configured.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-navy-800">
          {label}{" "}
          <span className="text-muted-foreground font-normal">
            ({selected.filter((x) => pcs.includes(x)).length}/{pcs.length})
          </span>
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAll}
            className="text-xs text-blue-600 hover:underline"
          >
            All
          </button>
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:underline"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {pcs.map((pc) => {
          const on = selected.includes(pc);
          return (
            <button
              key={pc}
              type="button"
              onClick={() => onToggle(pc)}
              className={`px-2.5 h-8 rounded-md text-xs font-medium border transition-colors ${
                on
                  ? "bg-navy-700 text-white border-navy-700"
                  : "bg-white text-navy-800 border-border hover:border-navy-400"
              }`}
            >
              {pc}
            </button>
          );
        })}
      </div>
    </div>
  );
}
