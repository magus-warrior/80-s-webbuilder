import { useEffect, useRef, useState } from 'react';

import type { Asset, Node, Project, ProjectSummary, ThemeToken } from './models';
import AuthScreen from './components/auth/AuthScreen';
import EditorLayout from './components/editor/EditorLayout';
import NodeRenderer from './components/editor/NodeRenderer';
import { ThemeProvider } from './components/editor/ThemeProvider';
import { useAuthStore } from './store/authStore';
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
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingProject, setIsLoadingProject] = useState(false);
  const [themeTokens, setThemeTokens] = useState<ThemeToken[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoadingAssets, setIsLoadingAssets] = useState(false);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const authToken = useAuthStore((state) => state.token);
  const authEmail = useAuthStore((state) => state.email);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const setNodes = useEditorStore((state) => state.setNodes);
  const editorNodes = useEditorStore((state) => state.nodes);
  const currentPageId = useEditorStore((state) => state.currentPageId);
  const setCurrentPageId = useEditorStore((state) => state.setCurrentPageId);
  const resolvedPageId = currentPageId ?? project?.pages[0]?.id ?? null;
  const previewPage =
    project?.pages.find((page) => page.id === resolvedPageId) ?? project?.pages[0];
  const previewNodes = editorNodes.length > 0 ? editorNodes : previewPage?.nodes ?? [];
  const saveTimeout = useRef<number | null>(null);
  const latestProject = useRef<Project | null>(null);
  const saveRequestId = useRef(0);
  const lastLoadedProjectId = useRef<string | null>(null);

  const parseProjectIdFromPath = () => {
    const match = window.location.pathname.match(/projects\/([^/]+)/);
    return match?.[1] ?? null;
  };

  const updateProjectRoute = (projectId: string) => {
    const nextPath = `/projects/${projectId}`;
    if (window.location.pathname !== nextPath) {
      window.history.replaceState(null, '', nextPath);
    }
  };

  const buildUpdatedProject = (
    base: Project,
    nodes: Node[],
    tokens: ThemeToken[],
    pageId: string | null
  ): Project => {
    const targetPageId = pageId ?? base.pages[0]?.id ?? null;
    return {
      ...base,
      updatedAt: new Date().toISOString(),
      themeTokens: tokens,
      pages: base.pages.map((page) =>
        page.id === targetPageId
          ? {
              ...page,
              nodes
            }
          : page
      )
    };
  };

  const hasProjectChanges = (
    base: Project,
    nodes: Node[],
    tokens: ThemeToken[],
    pageId: string | null
  ) => {
    const basePage = base.pages.find((page) => page.id === pageId) ?? base.pages[0];
    if (!basePage) {
      return false;
    }
    const baseNodes = basePage.nodes ?? [];
    const nodesMatch = JSON.stringify(baseNodes) === JSON.stringify(nodes);
    const tokensMatch = JSON.stringify(base.themeTokens ?? []) === JSON.stringify(tokens);
    return !(nodesMatch && tokensMatch);
  };

  const persistProject = async (nextProject: Project) => {
    if (!activeProjectId) {
      return;
    }
    const requestId = ++saveRequestId.current;
    setIsSaving(true);
    setProjectError(null);
    try {
      const response = await fetch(`/projects/${activeProjectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
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

  const handlePublishToggle = async (nextPublished: boolean) => {
    if (!activeProjectId || !project) {
      return;
    }
    setIsPublishing(true);
    setProjectError(null);
    try {
      const response = await fetch(`/projects/${activeProjectId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({ isPublished: nextPublished })
      });
      if (!response.ok) {
        throw new Error(`Publish update failed: ${response.status}`);
      }
      const updatedProject = (await response.json()) as Project;
      setProject(updatedProject);
      setProjectList((prev) =>
        prev.map((item) =>
          item.id === updatedProject.id
            ? {
                ...item,
                publicSlug: updatedProject.publicSlug ?? item.publicSlug,
                isPublished: updatedProject.isPublished,
                publishedAt: updatedProject.publishedAt ?? item.publishedAt
              }
            : item
        )
      );
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsPublishing(false);
    }
  };

  const publicLink = project?.publicSlug
    ? `${window.location.origin}/public/${project.publicSlug}`
    : null;

  useEffect(() => {
    if (!authToken) {
      setProject(null);
      setProjectList([]);
      setActiveProjectId(null);
      setIsLoadingProjects(false);
      setAssets([]);
      setAssetError(null);
      return;
    }

    const loadProjects = async () => {
      setIsLoadingProjects(true);
      setProjectError(null);
      try {
        const response = await fetch('/projects', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!response.ok) {
          throw new Error(`Project list failed: ${response.status}`);
        }
        const projects = (await response.json()) as ProjectSummary[];
        if (projects.length === 0) {
          const seedResponse = await fetch('/sample-project.json');
          if (!seedResponse.ok) {
            throw new Error(`Seed request failed: ${seedResponse.status}`);
          }
          const seedData = (await seedResponse.json()) as Project;
          const createdResponse = await fetch('/projects', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify(seedData)
          });
          if (!createdResponse.ok) {
            throw new Error(`Project create failed: ${createdResponse.status}`);
          }
          const createdProject = (await createdResponse.json()) as Project;
          setProject(createdProject);
          setProjectList([
            {
              id: createdProject.id,
              name: createdProject.name,
              updatedAt: createdProject.updatedAt
            }
          ]);
          setActiveProjectId(createdProject.id);
          updateProjectRoute(createdProject.id);
          return;
        }
        setProjectList(projects);
        const routeProjectId = parseProjectIdFromPath();
        const initialProjectId =
          routeProjectId && projects.some((item) => item.id === routeProjectId)
            ? routeProjectId
            : projects[0]?.id ?? null;
        if (initialProjectId) {
          setActiveProjectId(initialProjectId);
          updateProjectRoute(initialProjectId);
        }
      } catch (error) {
        setProjectError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoadingProjects(false);
      }
    };

    void loadProjects();
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      return;
    }
    const loadAssets = async () => {
      setIsLoadingAssets(true);
      setAssetError(null);
      try {
        const response = await fetch('/assets', {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!response.ok) {
          throw new Error(`Asset list failed: ${response.status}`);
        }
        const data = (await response.json()) as Asset[];
        setAssets(data);
      } catch (error) {
        setAssetError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoadingAssets(false);
      }
    };

    void loadAssets();
  }, [authToken]);

  useEffect(() => {
    if (!authToken || !activeProjectId) {
      return;
    }
    const loadProject = async () => {
      setIsLoadingProject(true);
      setProjectError(null);
      try {
        const response = await fetch(`/projects/${activeProjectId}`, {
          headers: { Authorization: `Bearer ${authToken}` }
        });
        if (!response.ok) {
          throw new Error(`Project request failed: ${response.status}`);
        }
        const data = (await response.json()) as Project;
        setProject(data);
      } catch (error) {
        setProjectError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoadingProject(false);
      }
    };

    void loadProject();
  }, [activeProjectId, authToken]);

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } finally {
      clearAuth();
      setProject(null);
      setProjectList([]);
      setActiveProjectId(null);
      setAssets([]);
      setAssetError(null);
    }
  };

  const handleAssetUpload = async (file: File) => {
    if (!authToken) {
      return null;
    }
    setIsUploadingAsset(true);
    setAssetError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/assets', {
        method: 'POST',
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: formData
      });
      if (!response.ok) {
        throw new Error(`Asset upload failed: ${response.status}`);
      }
      const uploaded = (await response.json()) as Asset;
      setAssets((prev) => [uploaded, ...prev]);
      return uploaded;
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : 'Unknown error');
      return null;
    } finally {
      setIsUploadingAsset(false);
    }
  };

  if (!authToken) {
    return <AuthScreen />;
  }

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
    const pageExists =
      currentPageId && project.pages.some((page) => page.id === currentPageId);
    const nextPageId = pageExists ? currentPageId : project.pages[0]?.id ?? null;
    if (nextPageId !== currentPageId) {
      setCurrentPageId(nextPageId);
    }
    if (lastLoadedProjectId.current !== project.id) {
      lastLoadedProjectId.current = project.id;
      setThemeTokens(project.themeTokens ?? []);
    }
  }, [currentPageId, project, setCurrentPageId]);

  useEffect(() => {
    latestProject.current = project;
  }, [project]);

  useEffect(() => {
    const baseProject = latestProject.current;
    if (!baseProject) {
      return;
    }

    if (!hasProjectChanges(baseProject, editorNodes, themeTokens, resolvedPageId)) {
      return;
    }

    const nextProject = buildUpdatedProject(
      baseProject,
      editorNodes,
      themeTokens,
      resolvedPageId
    );
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
  }, [editorNodes, resolvedPageId, themeTokens]);

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
                {authEmail ? (
                  <p className="mt-2 text-xs uppercase tracking-[0.25em] text-slate-400">
                    Signed in as {authEmail}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full border-neon px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-100 neon-glow-soft">
                  Template Ready
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-full border-neon-soft px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:brightness-110"
                >
                  Logout
                </button>
              </div>
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

          <EditorLayout
            projects={projectList}
            pages={project?.pages ?? []}
            activeProjectId={activeProjectId}
            activePageId={resolvedPageId}
            assets={assets}
            isLoadingAssets={isLoadingAssets}
            isUploadingAsset={isUploadingAsset}
            assetError={assetError}
            onUploadAsset={handleAssetUpload}
            onSelectProject={(projectId) => {
              setActiveProjectId(projectId);
              updateProjectRoute(projectId);
            }}
            onSelectPage={(pageId) => {
              setCurrentPageId(pageId);
            }}
            isLoadingProjects={isLoadingProjects}
          />

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
                  {project ? project.name : isLoadingProject ? 'Loading project...' : 'No project loaded'}
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
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-900/80 bg-black/60 px-6 py-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Publishing</p>
                <p className="mt-2 text-sm text-slate-200">
                  {project?.isPublished ? 'Published' : 'Draft'}
                </p>
                {publicLink ? (
                  <a
                    href={publicLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 block text-xs uppercase tracking-[0.2em] text-cyan-200 hover:text-cyan-100"
                  >
                    {publicLink}
                  </a>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => handlePublishToggle(!project?.isPublished)}
                disabled={!project || isPublishing}
                className="rounded-full border-neon-soft px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-200 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPublishing
                  ? 'Updating...'
                  : project?.isPublished
                    ? 'Unpublish'
                    : 'Publish'}
              </button>
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
