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

const reservedPublicSlugs = new Set(['projects', 'assets', 'auth', 'uploads', 'public']);

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
  const [publicSlugDraft, setPublicSlugDraft] = useState('');
  const [publicSlugStatus, setPublicSlugStatus] = useState<{
    state: 'idle' | 'checking' | 'available' | 'unavailable' | 'error';
    message?: string;
  }>({ state: 'idle' });
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
  const slugValidationTimeout = useRef<number | null>(null);

  const handleAuthFailure = (response: Response, onFail?: () => void) => {
    if (response.status === 401 || response.status === 403) {
      onFail?.();
      clearAuth();
      return true;
    }
    return false;
  };

  const parseProjectIdFromPath = () => {
    const match = window.location.pathname.match(/projects\/([^/]+)/);
    return match?.[1] ?? null;
  };

  const updateProjectRoute = (projectId: string | null) => {
    const nextPath = projectId ? `/projects/${projectId}` : '/';
    if (window.location.pathname !== nextPath) {
      window.history.replaceState(null, '', nextPath);
    }
  };

  const generateId = (prefix: string) => {
    if (crypto?.randomUUID) {
      return `${prefix}-${crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
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
      if (
        handleAuthFailure(response, () =>
          setProjectError('Session expired. Please sign in again.')
        )
      ) {
        return;
      }
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

  const applyProjectUpdate = (updatedProject: Project) => {
    setProject(updatedProject);
    setProjectList((prev) =>
      prev.map((item) =>
        item.id === updatedProject.id
          ? {
              ...item,
              name: updatedProject.name,
              updatedAt: updatedProject.updatedAt
            }
          : item
      )
    );
  };

  const requestProjectUpdate = async (payload: Record<string, unknown>) => {
    if (!activeProjectId) {
      return null;
    }
    setProjectError(null);
    try {
      const response = await fetch(`/projects/${activeProjectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(payload)
      });
      if (
        handleAuthFailure(response, () =>
          setProjectError('Session expired. Please sign in again.')
        )
      ) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Update failed: ${response.status}`);
      }
      const updatedProject = (await response.json()) as Project;
      applyProjectUpdate(updatedProject);
      return updatedProject;
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Unknown error');
      return null;
    }
  };

  const handlePublishToggle = async (nextPublished: boolean) => {
    if (!activeProjectId || !project) {
      return;
    }
    setIsPublishing(true);
    setProjectError(null);
    try {
      const payload: Record<string, unknown> = { isPublished: nextPublished };
      if (publicSlugDraft.trim()) {
        payload.publicSlug = publicSlugDraft.trim();
      }
      const response = await fetch(`/projects/${activeProjectId}/publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify(payload)
      });
      if (
        handleAuthFailure(response, () =>
          setProjectError('Session expired. Please sign in again.')
        )
      ) {
        return;
      }
      if (!response.ok) {
        let message = `Publish update failed: ${response.status}`;
        try {
          const data = (await response.json()) as { detail?: string };
          if (data.detail) {
            message = data.detail;
          }
        } catch {
          // ignore parsing errors
        }
        throw new Error(message);
      }
      const updatedProject = (await response.json()) as Project;
      setProject(updatedProject);
      setPublicSlugDraft(updatedProject.publicSlug ?? '');
      setPublicSlugStatus({ state: 'idle' });
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

  const publicSlug = project?.publicSlug;
  const publicLink = publicSlug
    ? reservedPublicSlugs.has(publicSlug)
      ? `${window.location.origin}/public/${publicSlug}`
      : `${window.location.origin}/${publicSlug}`
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
        if (
          handleAuthFailure(response, () =>
            setProjectError('Session expired. Please sign in again.')
          )
        ) {
          return;
        }
        if (!response.ok) {
          throw new Error(`Project list failed: ${response.status}`);
        }
        const projects = (await response.json()) as ProjectSummary[];
        if (projects.length === 0) {
          const seedUrl = new URL(
            `${import.meta.env.BASE_URL}sample-project.json`,
            window.location.origin
          );
          const seedResponse = await fetch(seedUrl.toString());
          if (!seedResponse.ok) {
            throw new Error(`Seed request failed: ${seedResponse.status}`);
          }
          const seedContentType = seedResponse.headers.get('content-type');
          if (!seedContentType?.includes('application/json')) {
            const seedBody = await seedResponse.text();
            throw new Error(
              `Seed data invalid: ${seedContentType ?? 'unknown content type'} (${seedBody.slice(
                0,
                80
              )})`
            );
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
        if (
          handleAuthFailure(response, () =>
            setAssetError('Session expired. Please sign in again.')
          )
        ) {
          return;
        }
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
        if (
          handleAuthFailure(response, () =>
            setProjectError('Session expired. Please sign in again.')
          )
        ) {
          return;
        }
        if (!response.ok) {
          throw new Error(`Project request failed: ${response.status}`);
        }
        const data = (await response.json()) as Project;
        const localProject = latestProject.current;
        if (localProject?.id === data.id) {
          const localUpdatedAt = Date.parse(localProject.updatedAt ?? '');
          const remoteUpdatedAt = Date.parse(data.updatedAt ?? '');
          if (
            Number.isFinite(localUpdatedAt) &&
            Number.isFinite(remoteUpdatedAt) &&
            localUpdatedAt > remoteUpdatedAt
          ) {
            return;
          }
        }
        setProject(data);
        setPublicSlugDraft(data.publicSlug ?? '');
        setPublicSlugStatus({ state: 'idle' });
      } catch (error) {
        setProjectError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setIsLoadingProject(false);
      }
    };

    void loadProject();
  }, [activeProjectId, authToken]);

  const validatePublicSlug = async (value: string) => {
    if (!authToken || !activeProjectId) {
      return;
    }
    if (!value.trim()) {
      setPublicSlugStatus({ state: 'idle' });
      return;
    }
    setPublicSlugStatus({ state: 'checking' });
    try {
      const response = await fetch(
        `/projects/${activeProjectId}/public-slug/validate?slug=${encodeURIComponent(
          value
        )}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );
      if (
        handleAuthFailure(response, () =>
          setProjectError('Session expired. Please sign in again.')
        )
      ) {
        return;
      }
      if (!response.ok) {
        let message = `Slug check failed: ${response.status}`;
        try {
          const data = (await response.json()) as { detail?: string };
          if (data.detail) {
            message = data.detail;
          }
        } catch {
          // ignore parsing errors
        }
        setPublicSlugStatus({ state: 'error', message });
        return;
      }
      const data = (await response.json()) as { slug: string; available: boolean };
      setPublicSlugDraft(data.slug);
      setPublicSlugStatus(
        data.available
          ? { state: 'available', message: 'Slug is available.' }
          : { state: 'unavailable', message: 'Slug is already taken. Choose another.' }
      );
    } catch (error) {
      setPublicSlugStatus({
        state: 'error',
        message: error instanceof Error ? error.message : 'Slug check failed.'
      });
    }
  };

  useEffect(() => {
    if (!authToken || !activeProjectId) {
      return;
    }
    if (slugValidationTimeout.current) {
      window.clearTimeout(slugValidationTimeout.current);
    }
    if (!publicSlugDraft.trim()) {
      setPublicSlugStatus({ state: 'idle' });
      return;
    }
    slugValidationTimeout.current = window.setTimeout(() => {
      void validatePublicSlug(publicSlugDraft);
    }, 450);

    return () => {
      if (slugValidationTimeout.current) {
        window.clearTimeout(slugValidationTimeout.current);
      }
    };
  }, [activeProjectId, authToken, publicSlugDraft]);

  const handleLogout = async () => {
    try {
      await fetch('/auth/logout', { method: 'POST' });
    } finally {
      clearAuth();
      setProject(null);
      setProjectList([]);
      setActiveProjectId(null);
      updateProjectRoute(null);
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

  const validateProjectName = async (
    name: string,
    projectId?: string | null
  ): Promise<{ name: string; slug: string; available: boolean } | null> => {
    if (!authToken) {
      return null;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }
    try {
      const params = new URLSearchParams({ name: trimmed });
      if (projectId) {
        params.set('projectId', projectId);
      }
      const response = await fetch(`/projects/validate-name?${params.toString()}`, {
        headers: {
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        }
      });
      if (
        handleAuthFailure(response, () =>
          setProjectError('Session expired. Please sign in again.')
        )
      ) {
        return null;
      }
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as { name: string; slug: string; available: boolean };
    } catch {
      return null;
    }
  };

  const handleCreateProject = async (name: string) => {
    if (!authToken) {
      return false;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setProjectError('Project name is required.');
      return false;
    }
    const pageId = generateId('page');
    const payload = {
      name: trimmed,
      description: '',
      updatedAt: new Date().toISOString(),
      pages: [
        {
          id: pageId,
          title: 'Home',
          path: '/',
          nodes: []
        }
      ],
      themeTokens: []
    };
    setProjectError(null);
    try {
      const response = await fetch('/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Project create failed: ${response.status}`);
      }
      const createdProject = (await response.json()) as Project;
      setProject(createdProject);
      setProjectList((prev) => [
        {
          id: createdProject.id,
          name: createdProject.name,
          updatedAt: createdProject.updatedAt
        },
        ...prev
      ]);
      setActiveProjectId(createdProject.id);
      setCurrentPageId(createdProject.pages[0]?.id ?? null);
      updateProjectRoute(createdProject.id);
      return true;
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  };

  const handleRenameProject = async (projectId: string, name: string) => {
    if (!authToken) {
      return false;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      setProjectError('Project name is required.');
      return false;
    }
    const response = await fetch(`/projects/${projectId}/metadata`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({
        name: trimmed,
        description: project?.id === projectId ? project.description : undefined
      })
    });
    if (
      handleAuthFailure(response, () =>
        setProjectError('Session expired. Please sign in again.')
      )
    ) {
      return false;
    }
    if (!response.ok) {
      setProjectError(`Rename failed: ${response.status}`);
      return false;
    }
    const updatedProject = (await response.json()) as Project;
    applyProjectUpdate(updatedProject);
    return true;
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!authToken) {
      return;
    }
    const projectName =
      project?.id === projectId
        ? project.name
        : projectList.find((item) => item.id === projectId)?.name ?? 'this project';
    const confirmed = window.confirm(`Delete ${projectName}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    setProjectError(null);
    const response = await fetch(`/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      }
    });
    if (
      handleAuthFailure(response, () =>
        setProjectError('Session expired. Please sign in again.')
      )
    ) {
      return;
    }
    if (!response.ok) {
      setProjectError(`Delete failed: ${response.status}`);
      return;
    }
    setProjectList((prev) => prev.filter((item) => item.id !== projectId));
    if (activeProjectId === projectId) {
      const remaining = projectList.filter((item) => item.id !== projectId);
      const nextProjectId = remaining[0]?.id ?? null;
      setActiveProjectId(nextProjectId);
      setProject(null);
      setCurrentPageId(null);
      updateProjectRoute(nextProjectId);
    }
  };

  const handleAddPage = async () => {
    if (!project || !activeProjectId) {
      return;
    }
    const titleInput = window.prompt('Page title', 'New page');
    if (titleInput === null) {
      return;
    }
    const title = titleInput.trim();
    if (!title) {
      setProjectError('Page title is required.');
      return;
    }
    const pathInput = window.prompt('Page path', '/new-page');
    if (pathInput === null) {
      return;
    }
    const path = pathInput.trim();
    if (!path) {
      setProjectError('Page path is required.');
      return;
    }
    const mutation = {
      action: 'create',
      id: generateId('page'),
      title,
      path,
      nodes: []
    };
    const updated = await requestProjectUpdate({
      pageMutations: [mutation],
      updatedAt: new Date().toISOString()
    });
    if (updated) {
      const newPage = updated.pages[updated.pages.length - 1];
      if (newPage?.id) {
        setCurrentPageId(newPage.id);
      }
    }
  };

  const handleRenamePage = async (pageId: string) => {
    if (!project || !activeProjectId) {
      return;
    }
    const page = project.pages.find((item) => item.id === pageId);
    if (!page) {
      return;
    }
    const titleInput = window.prompt('Rename page', page.title);
    if (titleInput === null) {
      return;
    }
    const nextTitle = titleInput.trim();
    if (!nextTitle) {
      setProjectError('Page title is required.');
      return;
    }
    const pathInput = window.prompt('Page path', page.path);
    if (pathInput === null) {
      return;
    }
    const nextPath = pathInput.trim();
    if (!nextPath) {
      setProjectError('Page path is required.');
      return;
    }
    await requestProjectUpdate({
      pageMutations: [
        {
          action: 'update',
          id: pageId,
          title: nextTitle,
          path: nextPath
        }
      ],
      updatedAt: new Date().toISOString()
    });
  };

  const handleDeletePage = async (pageId: string) => {
    if (!project || !activeProjectId) {
      return;
    }
    const page = project.pages.find((item) => item.id === pageId);
    const confirmed = window.confirm(
      `Delete ${page?.title ?? 'this page'}? This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    await requestProjectUpdate({
      pageMutations: [
        {
          action: 'delete',
          id: pageId
        }
      ],
      updatedAt: new Date().toISOString()
    });
  };

  if (!authToken) {
    return <AuthScreen />;
  }

  const isPublishDisabled =
    !project ||
    isPublishing ||
    publicSlugStatus.state === 'unavailable' ||
    publicSlugStatus.state === 'error';

  return (
    <ThemeProvider tokens={themeTokens} onTokensChange={setThemeTokens}>
      <div className="min-h-screen bg-gradient-to-br from-black via-slate-950 to-slate-900 text-slate-100">
        <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col gap-16 px-6 py-12">
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
            onCreateProject={handleCreateProject}
            onRenameProject={handleRenameProject}
            onValidateProjectName={validateProjectName}
            onDeleteProject={handleDeleteProject}
            onAddPage={handleAddPage}
            onRenamePage={handleRenamePage}
            onDeletePage={handleDeletePage}
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
                <label className="mt-4 block text-xs uppercase tracking-[0.2em] text-slate-400">
                  Public slug
                  <input
                    type="text"
                    value={publicSlugDraft}
                    onChange={(event) => {
                      setPublicSlugDraft(event.target.value);
                      setPublicSlugStatus({ state: 'idle' });
                    }}
                    onBlur={(event) => {
                      void validatePublicSlug(event.target.value);
                    }}
                    placeholder="your-project"
                    className="mt-2 w-full rounded-lg border border-slate-800/80 bg-black/60 px-3 py-2 text-sm normal-case text-slate-100 focus:border-cyan-200 focus:outline-none"
                  />
                </label>
                {publicSlugStatus.state !== 'idle' ? (
                  <p
                    className={`mt-2 text-xs ${
                      publicSlugStatus.state === 'available'
                        ? 'text-cyan-200'
                        : publicSlugStatus.state === 'checking'
                          ? 'text-slate-400'
                          : 'text-rose-300'
                    }`}
                  >
                    {publicSlugStatus.state === 'checking'
                      ? 'Checking slug availability...'
                      : publicSlugStatus.message}
                  </p>
                ) : null}
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
                disabled={isPublishDisabled}
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
