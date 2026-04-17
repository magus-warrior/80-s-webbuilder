interface InspectorSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export default function InspectorSection({ title, isOpen, onToggle, children }: InspectorSectionProps) {
  return (
    <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={isOpen}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{title}</p>
        <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
          {isOpen ? 'Collapse' : 'Expand'}
        </span>
      </button>
      <div
        className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
          isOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}
