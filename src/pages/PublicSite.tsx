import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import NodeRenderer from '../components/editor/NodeRenderer';
import { ThemeProvider, useTheme } from '../components/editor/ThemeProvider';
import type { Project } from '../models';
import { useAuthStore } from '../store/authStore';

const fallbackThemeTokens: Project['themeTokens'] = [];

type PublicSiteShellProps = {
  project: Project | null;
  error: string | null;
  isLoading: boolean;
  isSignedIn: boolean;
};

function PublicSiteShell({
  project,
  error,
  isLoading,
  isSignedIn
}: PublicSiteShellProps) {
  const { cssVariables } = useTheme();
  const page =
    project?.pages?.find((entry) => entry.id === project.publicPageId) ??
    project?.pages?.[0];
  const nodes = page?.nodes ?? [];
  const publishedAt = project?.publishedAt
    ? new Date(project.publishedAt).toLocaleString()
    : null;

  return (
    <div
      style={cssVariables}
      className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-slate-900 text-slate-100"
    >
      <div className="w-full px-5 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto flex min-h-screen w-full max-w-[96rem] flex-col gap-8 sm:gap-10">
          <header className="rounded-3xl border-neon bg-slate-950/80 p-6 shadow-xl neon-glow-soft sm:p-8">
          {isSignedIn ? (
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">
              Live Site
            </p>
          ) : null}
          <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">
            {project?.name ?? 'Loading public site'}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            {project?.description ??
              'This is the published version of your page.'}
          </p>
          {isSignedIn && project?.id ? (
            <div className="mt-6">
              <Link
                to={`/projects/${project.id}`}
                className="inline-flex items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-100 transition hover:border-cyan-300/80 hover:bg-cyan-500/20"
              >
                Open Project
              </Link>
            </div>
          ) : null}
          {isSignedIn && publishedAt ? (
            <p className="mt-4 text-xs uppercase tracking-[0.25em] text-slate-400">
              Published {publishedAt}
            </p>
          ) : null}
          </header>

          {isLoading ? (
            <section className="w-full rounded-2xl border border-slate-900/80 bg-black/60 p-6 text-sm text-slate-300">
              Loading site...
            </section>
          ) : error ? (
            <section className="w-full rounded-2xl border border-rose-500/40 bg-rose-950/40 p-6 text-sm text-rose-200">
              We couldn&apos;t load this page right now.
            </section>
          ) : (
            <section className="w-full rounded-3xl border border-slate-900/80 bg-black/60 p-4 shadow-lg shadow-black/60 sm:p-6">
              {nodes.length ? (
                <div className="mx-auto w-full max-w-[96rem] space-y-4 [&_p]:max-w-[70ch] [&_h1]:max-w-[22ch] [&_h2]:max-w-[26ch] [&_h3]:max-w-[30ch] [&_li]:max-w-[70ch]">
                  {nodes.map((node) => (
                    <NodeRenderer key={node.id} node={node} interactive={false} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-300">This page has no published content yet.</p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PublicSite() {
  const { slug } = useParams<{ slug: string }>();
  const authToken = useAuthStore((state) => state.token);
  const isSignedIn = Boolean(authToken);
  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProjectOwner, setIsProjectOwner] = useState(false);

  const handleTokensChange = useCallback(() => {}, []);

  useEffect(() => {
    if (!slug) {
      setError('Missing public site slug.');
      setProject(null);
      setIsProjectOwner(false);
      return;
    }

    const controller = new AbortController();
    const loadPublicProject = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/public/${slug}`, {
          signal: controller.signal,
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache'
          }
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

  useEffect(() => {
    if (!authToken || !project?.id) {
      setIsProjectOwner(false);
      return;
    }

    const controller = new AbortController();
    const checkOwnership = async () => {
      try {
        const response = await fetch('/projects', {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        });
        if (!response.ok) {
          throw new Error(`Project ownership check failed: ${response.status}`);
        }
        const myProjects = (await response.json()) as Array<{ id: string }>;
        setIsProjectOwner(myProjects.some((entry) => entry.id === project.id));
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setIsProjectOwner(false);
      }
    };

    void checkOwnership();
    return () => controller.abort();
  }, [authToken, project?.id]);

  const themeTokens = useMemo(
    () => project?.themeTokens ?? fallbackThemeTokens,
    [project?.themeTokens]
  );

  return (
    <ThemeProvider tokens={themeTokens} onTokensChange={handleTokensChange}>
      <PublicSiteShell
        project={project}
        error={error}
        isLoading={isLoading}
        isSignedIn={isSignedIn && isProjectOwner}
      />
    </ThemeProvider>
  );
}
