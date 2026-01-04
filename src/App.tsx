import { useEffect, useState } from 'react';

import type { Project } from './models';
import EditorLayout from './components/editor/EditorLayout';

const features = [
  {
    title: 'Retro-ready layouts',
    description: 'Grid-based sections with neon accents and high-contrast surfaces.'
  },
  {
    title: 'Component building blocks',
    description: 'Reusable cards, buttons, and status badges for quick assembly.'
  },
  {
    title: 'Instant theming',
    description: 'Swap palettes with Tailwind utility classes and CSS variables.'
  }
];

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      try {
        const response = await fetch('/sample-project.json');
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        const data = (await response.json()) as Project;
        setProject(data);
      } catch (error) {
        setProjectError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    void loadProject();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-fuchsia-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 py-12">
        <header className="flex flex-col gap-6 rounded-3xl border border-fuchsia-500/30 bg-slate-900/70 p-10 shadow-xl shadow-fuchsia-500/10">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-300">Tailwind Online</p>
              <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
                80&apos;s Webbuilder
              </h1>
            </div>
            <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-fuchsia-200">
              Tailwind Ready
            </span>
          </div>
          <p className="max-w-2xl text-lg text-slate-200">
            This layout is built with Tailwind CSS utility classes to confirm styles are applying on the
            main page. The neon gradient, glassy card, and glowing buttons all use Tailwind styling.
          </p>
          <div className="flex flex-wrap gap-4">
            <button className="rounded-full bg-fuchsia-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-fuchsia-500/40 transition hover:translate-y-0.5 hover:bg-fuchsia-400">
              Launch Builder
            </button>
            <button className="rounded-full border border-slate-500 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-fuchsia-400 hover:text-white">
              View Templates
            </button>
          </div>
        </header>

        <EditorLayout />

        <main className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-lg shadow-slate-900/50"
            >
              <h2 className="text-lg font-semibold text-white">{feature.title}</h2>
              <p className="mt-3 text-sm text-slate-300">{feature.description}</p>
            </article>
          ))}
        </main>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-8 shadow-lg shadow-slate-900/60">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-fuchsia-300">Local JSON</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                {project ? project.name : 'Loading project...'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                {project?.description ??
                  'Fetching the sample JSON to render pages, nodes, and theme tokens.'}
              </p>
              {projectError ? (
                <p className="mt-3 text-sm text-rose-300">Error: {projectError}</p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-6 py-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Last updated</p>
              <p className="mt-2 text-sm text-slate-200">
                {project ? new Date(project.updatedAt).toLocaleString() : '—'}
              </p>
            </div>
          </div>
          {project ? (
            <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-fuchsia-200">
                  Pages & Nodes
                </h3>
                <div className="space-y-4">
                  {project.pages.map((page) => (
                    <div key={page.id} className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-white">{page.title}</p>
                          <p className="text-xs text-slate-400">{page.path}</p>
                        </div>
                        <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1 text-xs text-fuchsia-200">
                          {page.nodes.length} nodes
                        </span>
                      </div>
                      <ul className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                        {page.nodes.map((node) => (
                          <li key={node.id} className="rounded-lg border border-slate-800 bg-slate-900/70 p-2">
                            <p className="font-semibold text-slate-100">{node.name}</p>
                            <p className="text-[0.7rem] uppercase tracking-[0.2em] text-slate-400">
                              {node.type}
                            </p>
                            {node.children ? (
                              <p className="mt-1 text-[0.7rem] text-slate-400">
                                {node.children.length} child nodes
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-fuchsia-200">
                  Theme Tokens
                </h3>
                <div className="space-y-3">
                  {project.themeTokens.map((token) => (
                    <div
                      key={token.name}
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{token.name}</p>
                        <p className="text-xs text-slate-400">{token.description}</p>
                      </div>
                      <span className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs text-slate-200">
                        {token.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-800 bg-slate-950/60 p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h3 className="text-xl font-semibold text-white">Ready to build?</h3>
              <p className="mt-2 text-sm text-slate-300">
                Tailwind styles are now wired up and ready for your next layout.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full bg-emerald-400 shadow shadow-emerald-400/60" />
              <span className="text-xs uppercase tracking-[0.2em] text-emerald-200">Live Styles</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
