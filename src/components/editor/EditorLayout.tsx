export default function EditorLayout() {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6 shadow-2xl shadow-slate-900/70">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-300">Editor Workspace</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Drag, drop, and refine</h2>
        </div>
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-300">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          Live Preview
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)_minmax(240px,0.9fr)]">
        <aside className="flex h-full flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-fuchsia-200">Blocks</h3>
            <span className="rounded-full border border-slate-700 px-2 py-1 text-[0.65rem] text-slate-300">
              12 items
            </span>
          </div>
          <div className="space-y-3">
            {['Hero', 'Gallery', 'Pricing', 'Testimonials'].map((block) => (
              <button
                key={block}
                className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-fuchsia-400/60 hover:text-white"
              >
                <span>{block}</span>
                <span className="text-xs text-slate-400">+ add</span>
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-300">
            Tip: Drag blocks onto the canvas to compose your page.
          </div>
        </aside>

        <div className="flex h-full flex-col gap-4 rounded-2xl border border-fuchsia-500/30 bg-slate-900/80 p-5 shadow-lg shadow-fuchsia-500/10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-fuchsia-200">Canvas</h3>
            <div className="flex gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-slate-700 px-2 py-1">Desktop</span>
              <span className="rounded-full border border-slate-700 px-2 py-1">100%</span>
            </div>
          </div>
          <div className="flex-1 rounded-2xl border border-dashed border-fuchsia-400/60 bg-slate-950/80 p-6">
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-300">
              <p className="text-sm">Drop components here to start building.</p>
              <button className="rounded-full bg-fuchsia-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
                Add section
              </button>
            </div>
          </div>
        </div>

        <aside className="flex h-full flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-fuchsia-200">
              Inspector
            </h3>
            <span className="text-xs text-slate-400">Layer 3</span>
          </div>
          <div className="space-y-4 text-sm text-slate-200">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Spacing</p>
              <p className="mt-2">Padding: 32px</p>
              <p>Gap: 16px</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Typography</p>
              <p className="mt-2">Heading: 32px / 600</p>
              <p>Body: 16px / 400</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Effects</p>
              <p className="mt-2">Glow: Fuchsia 40%</p>
              <p>Shadow: Soft</p>
            </div>
          </div>
          <button className="mt-auto rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-200 transition hover:border-fuchsia-400/60 hover:text-white">
            Reset styles
          </button>
        </aside>
      </div>
    </section>
  );
}
