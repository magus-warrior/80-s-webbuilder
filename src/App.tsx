import { useEffect, useRef, useState } from 'react';

import type { Node, Project, ThemeToken } from './models';
import EditorLayout from './components/editor/EditorLayout';
import NodeRenderer from './components/editor/NodeRenderer';
import { ThemeProvider } from './components/editor/ThemeProvider';
import { useEditorStore } from './store/editorStore';

const features = [
  {
    title: 'Studio-ready layouts',
    description: 'Grid-based sections framed with luxe gradients and refined accents.'
  },
  {
    title: 'Modular templates',
    description: 'Reusable cards, buttons, and status badges for polished compositions.'
  },
  {
    title: 'Instant palette shifts',
    description: 'Swap palettes with Tailwind utility classes and CSS variables.'
  }
];

export default function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [themeTokens, setThemeTokens] = useState<ThemeToken[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const setNodes = useEditorStore((state) => state.setNodes);
  const editorNodes = useEditorStore((state) => state.nodes);
  const previewPage = project?.pages[0];
  const previewNodes = editorNodes.length > 0 ? editorNodes : previewPage?.nodes ?? [];
  const saveTimeout = useRef<number | null>(null);
  const latestProject = useRef<Project | null>(null);
  const saveRequestId = useRef(0);
  const lastLoadedProjectId = useRef<string | null>(null);
  const projectId = 1;

  const buildUpdatedProject = (base: Project, nodes: Node[], tokens: ThemeToken[]): Project => ({
    ...base,
    updatedAt: new Date().toISOString(),
    themeTokens: tokens,
    pages: base.pages.map((page, index) =>
      index === 0
        ? {
            ...page,
            nodes
          }
        : page
    )
  });

  const hasProjectChanges = (base: Project, nodes: Node[], tokens: ThemeToken[]) => {
    const baseNodes = base.pages[0]?.nodes ?? [];
    const nodesMatch = JSON.stringify(baseNodes) === JSON.stringify(nodes);
    const tokensMatch = JSON.stringify(base.themeTokens ?? []) === JSON.stringify(tokens);
    return !(nodesMatch && tokensMatch);
  };

  const persistProject = async (nextProject: Project) => {
    const requestId = ++saveRequestId.current;
    setIsSaving(true);
    setProjectError(null);
    try {
      const response = await fetch(`/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextProject)
      });
      if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`);
      }
      const savedProject = (await response.json()) as Project;
      const matchesLatest = requestId === saveRequestId.current;
      const matchesUpdatedAt = savedProject.updatedAt === latestProject.current?.updatedAt;
      if (matchesLatest || matchesUpdatedAt) {
        if (
          JSON.stringify(savedProject.themeTokens ?? []) !== JSON.stringify(themeTokens)
        ) {
          setThemeTokens(savedProject.themeTokens ?? []);
        }
        setProject(savedProject);
      }
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const loadProject = async () => {
      try {
        const response = await fetch(`/projects/${projectId}`);
        if (response.ok) {
          const data = (await response.json()) as Project;
          setProject(data);
          return;
        }
        if (response.status !== 404) {
          throw new Error(`Request failed: ${response.status}`);
        }
        const seedResponse = await fetch('/sample-project.json');
        if (!seedResponse.ok) {
          throw new Error(`Seed request failed: ${seedResponse.status}`);
        }
        const seedData = (await seedResponse.json()) as Project;
        setProject(seedData);
        await persistProject(seedData);
      } catch (error) {
        setProjectError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    void loadProject();
  }, []);

  useEffect(() => {
    if (previewPage?.nodes) {
      const currentNodes = useEditorStore.getState().nodes;
      if (JSON.stringify(currentNodes) !== JSON.stringify(previewPage.nodes)) {
        setNodes(previewPage.nodes);
      }
    }
  }, [previewPage, setNodes]);

  useEffect(() => {
    if (!project) {
      return;
    }
    if (lastLoadedProjectId.current !== project.id) {
      lastLoadedProjectId.current = project.id;
      setThemeTokens(project.themeTokens ?? []);
    }
  }, [project]);

  useEffect(() => {
    latestProject.current = project;
  }, [project]);

  useEffect(() => {
    const baseProject = latestProject.current;
    if (!baseProject) {
      return;
    }

    if (!hasProjectChanges(baseProject, editorNodes, themeTokens)) {
      return;
    }

    const nextProject = buildUpdatedProject(baseProject, editorNodes, themeTokens);
    setProject(nextProject);

    if (saveTimeout.current) {
      window.clearTimeout(saveTimeout.current);
    }
    saveTimeout.current = window.setTimeout(() => {
      void persistProject(nextProject);
    }, 600);

    return () => {
      if (saveTimeout.current) {
        window.clearTimeout(saveTimeout.current);
      }
    };
  }, [editorNodes, themeTokens]);

  return (
    <ThemeProvider tokens={themeTokens} onTokensChange={setThemeTokens}>
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-slate-900 text-slate-100">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-16 px-6 py-12">
          <header className="flex flex-col gap-6 rounded-3xl border-neon bg-slate-950/80 p-10 shadow-xl neon-glow-soft">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Studio Suite</p>
                <h1 className="mt-4 text-4xl font-semibold text-white sm:text-5xl">
                  Studio Site Builder
                </h1>
              </div>
              <span className="rounded-full border-neon px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-100 neon-glow-soft">
                Template Ready
              </span>
            </div>
            <p className="max-w-2xl text-lg text-slate-200">
              This layout confirms studio-grade styling is live. The obsidian gradient, soft shadowed cards,
              and refined accents are all Tailwind-powered.
            </p>
            <div className="flex flex-wrap gap-4">
              <button className="rounded-full bg-neon-gradient px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg neon-glow transition hover:translate-y-0.5 hover:brightness-110">
                Open Studio
              </button>
              <button className="rounded-full border-neon-soft px-6 py-3 text-sm font-semibold text-slate-100 transition hover:brightness-110">
                Explore Templates
              </button>
            </div>
          </header>

          <EditorLayout />

          <main className="grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-900/80 bg-slate-950/70 p-6 shadow-lg shadow-black/40"
              >
                <h2 className="text-lg font-semibold text-white">{feature.title}</h2>
                <p className="mt-3 text-sm text-slate-300">{feature.description}</p>
              </article>
            ))}
          </main>

          <section className="rounded-2xl border-neon-soft bg-slate-950/70 p-8 shadow-lg shadow-black/60">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">Local JSON</p>
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
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                  {isSaving ? 'Saving changes…' : 'All changes saved'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-900/80 bg-black/70 px-6 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Last updated</p>
                <p className="mt-2 text-sm text-slate-200">
                  {project ? new Date(project.updatedAt).toLocaleString() : '—'}
                </p>
              </div>
            </div>
            {project ? (
              <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-transparent bg-neon-gradient bg-clip-text">
                    Pages & Nodes
                  </h3>
                  <div className="space-y-4">
                    {project.pages.map((page) => (
                      <div key={page.id} className="rounded-xl border border-slate-900/80 bg-black/60 p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-white">{page.title}</p>
                            <p className="text-xs text-slate-400">{page.path}</p>
                          </div>
                          <span className="rounded-full border-neon px-3 py-1 text-xs text-slate-100 neon-glow-soft">
                            {page.nodes.length} nodes
                          </span>
                        </div>
                        <ul className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                          {page.nodes.map((node) => (
                            <li key={node.id} className="rounded-lg border border-slate-900/80 bg-slate-950/60 p-2">
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
                  <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">Rendered Preview</p>
                        <p className="text-xs text-slate-400">
                          {previewPage ? `${previewPage.title} nodes` : 'No page selected'}
                        </p>
                      </div>
                      <span className="rounded-full border border-slate-700/80 bg-black/60 px-3 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-slate-400">
                        Renderer
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {previewNodes.map((node) => (
                        <NodeRenderer key={node.id} node={node} interactive={false} />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-transparent bg-neon-gradient bg-clip-text">
                    Theme Tokens
                  </h3>
                  <div className="space-y-3">
                    {themeTokens.map((token) => (
                      <div
                        key={token.name}
                        className="flex items-center justify-between gap-4 rounded-xl border border-slate-900/80 bg-black/60 px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{token.name}</p>
                          <p className="text-xs text-slate-400">{token.description}</p>
                        </div>
                        <span className="rounded-full border-neon-soft bg-black/60 px-3 py-1 text-xs text-slate-100">
                          {token.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-slate-900/80 bg-black/60 p-8">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-semibold text-white">Ready to publish?</h3>
                <p className="mt-2 text-sm text-slate-300">
                  Tailwind styles are now wired up for your next elegant layout.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-neon-gradient shadow-lg neon-glow-soft" />
                <span className="text-xs uppercase tracking-[0.2em] text-slate-200">Live Styles</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </ThemeProvider>
  );
}
