import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import NodeRenderer from '../components/editor/NodeRenderer';
import { ThemeProvider, useTheme } from '../components/editor/ThemeProvider';
import type { Project } from '../models';

const fallbackThemeTokens: Project['themeTokens'] = [];

type PublicSiteShellProps = {
  project: Project | null;
  error: string | null;
  isLoading: boolean;
};

function PublicSiteShell({ project, error, isLoading }: PublicSiteShellProps) {
  const { cssVariables } = useTheme();
  const page = project?.pages?.[0];
  const nodes = page?.nodes ?? [];
  const publishedAt = project?.publishedAt
    ? new Date(project.publishedAt).toLocaleString()
    : null;

  return (
    <div
      style={cssVariables}
      className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-slate-900 text-slate-100"
    >
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-10 px-6 py-12">
        <header className="rounded-3xl border-neon bg-slate-950/80 p-8 shadow-xl neon-glow-soft">
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
            Public Showcase
          </p>
          <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
            {project?.name ?? 'Loading public site'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            {project?.description ??
              'This published layout is powered by your saved nodes and theme tokens.'}
          </p>
          {publishedAt ? (
            <p className="mt-4 text-xs uppercase tracking-[0.25em] text-slate-400">
              Published {publishedAt}
            </p>
          ) : null}
        </header>

        {isLoading ? (
          <section className="rounded-2xl border border-slate-900/80 bg-black/60 p-6 text-sm text-slate-300">
            Loading published content...
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-6 text-sm text-rose-200">
            {error}
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-900/80 bg-black/60 p-6 shadow-lg shadow-black/60">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
                  Rendered Nodes
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">
                  {page?.title ?? 'Untitled Page'}
                </h2>
                <p className="mt-2 text-xs text-slate-400">
                  {nodes.length} nodes published
                </p>
              </div>
              <span className="rounded-full border-neon-soft px-4 py-2 text-[0.65rem] uppercase tracking-[0.3em] text-slate-200">
                View Only
              </span>
            </div>
            <div className="mt-6 space-y-4">
              {nodes.length > 0 ? (
                nodes.map((node) => (
                  <NodeRenderer key={node.id} node={node} interactive={false} />
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-sm text-slate-400">
                  No nodes are available for this published page.
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default function PublicSite() {
  const { slug } = useParams<{ slug: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleTokensChange = useCallback(() => {}, []);

  useEffect(() => {
    if (!slug) {
      setError('Missing public site slug.');
      setProject(null);
      return;
    }

    const controller = new AbortController();
    const loadPublicProject = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/public/${slug}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error(`Public project request failed: ${response.status}`);
        }
        const data = (await response.json()) as Project;
        setProject(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load public site.');
        setProject(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadPublicProject();

    return () => controller.abort();
  }, [slug]);

  const themeTokens = useMemo(
    () => project?.themeTokens ?? fallbackThemeTokens,
    [project?.themeTokens]
  );

  return (
    <ThemeProvider tokens={themeTokens} onTokensChange={handleTokensChange}>
      <PublicSiteShell project={project} error={error} isLoading={isLoading} />
    </ThemeProvider>
  );
}
