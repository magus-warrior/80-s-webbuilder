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
  slug?: string;
};

function PublicSiteShell({
  project,
  error,
  isLoading,
  slug
}: PublicSiteShellProps) {
  const { cssVariables } = useTheme();
  const page =
    project?.pages?.find((entry) => entry.id === project.publicPageId) ??
    project?.pages?.[0];
  const nodes = page?.nodes ?? [];

  return (
    <div
      style={cssVariables}
      className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-slate-900 text-slate-100"
    >
      <div className="w-full px-3 py-6 sm:px-6 sm:py-12">
        <div className="mx-auto flex min-h-screen w-full max-w-[96rem] flex-col gap-8 sm:gap-10">
          {isLoading ? (
            <section className="w-full rounded-2xl border border-slate-900/80 bg-black/60 p-6 text-sm text-slate-300">
              Loading site...
            </section>
          ) : error ? (
            <section className="w-full rounded-2xl border border-rose-500/40 bg-rose-950/40 p-6 text-sm text-rose-200">
              We couldn&apos;t load this page right now.
            </section>
          ) : (
            <section className="w-full overflow-hidden rounded-3xl border border-slate-900/80 bg-black/60 p-3 shadow-lg shadow-black/60 sm:p-6">
              {nodes.length ? (
                <div className="mx-auto w-full max-w-[96rem] space-y-3 [&_*]:min-w-0 [&_a]:break-words [&_h1]:max-w-[22ch] [&_h2]:max-w-[26ch] [&_h3]:max-w-[30ch] [&_li]:max-w-[70ch] [&_p]:max-w-[70ch]">
                  {nodes.map((node) => (
                    <NodeRenderer
                      key={node.id}
                      node={node}
                      interactive={false}
                      publicSlug={project?.publicSlug ?? slug ?? null}
                    />
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
        try {
          await fetch(`/api/public/${slug}/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventType: 'page_view',
              nodeId: data.publicPageId ?? data.pages?.[0]?.id ?? 'page',
              nodeType: 'page',
              nodeName: data.name
            })
          });
        } catch {
          // Ignore analytics tracking errors for visitors.
        }
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
      <PublicSiteShell
        project={project}
        error={error}
        isLoading={isLoading}
        slug={slug}
      />
    </ThemeProvider>
  );
}
