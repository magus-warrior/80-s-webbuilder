import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';

import type { Asset, ComponentFamily, Node, NodePropValue, Page, ProjectSummary } from '../../models';
import { useEditorStore } from '../../store/editorStore';
import NodeRenderer from './NodeRenderer';
import { getNodeSchema } from './nodeSchemas';
import { blockTemplates, buildNodeFromTemplate } from './templates';
import { useTheme } from './ThemeProvider';
import NodeInspectorPanel from './inspector/NodeInspectorPanel';
import {
  collectComponentOverrideFields,
  createComponentId,
  createComponentInstanceNode,
  getComponentInstanceMetadata,
  isComponentInstanceNode
} from './componentInstances';

const findNodeById = (nodes: Node[], nodeId: string | null): Node | null => {
  if (!nodeId) {
    return null;
  }

  const stack = [...nodes];

  while (stack.length > 0) {
    const current = stack.shift();
    if (!current) {
      continue;
    }
    if (current.id === nodeId) {
      return current;
    }
    if (current.children) {
      stack.unshift(...current.children);
    }
  }

  return null;
};

const findNodePathById = (nodes: Node[], nodeId: string | null): Node[] => {
  if (!nodeId) {
    return [];
  }

  const search = (items: Node[], path: Node[]): Node[] | null => {
    for (const item of items) {
      const nextPath = [...path, item];
      if (item.id === nodeId) {
        return nextPath;
      }
      if (item.children?.length) {
        const result = search(item.children, nextPath);
        if (result) {
          return result;
        }
      }
    }
    return null;
  };

  return search(nodes, []) ?? [];
};

type LayerItem = {
  node: Node;
  depth: number;
  parentId: string | null;
};

const buildLayerItems = (
  nodes: Node[],
  depth = 0,
  parentId: string | null = null
): LayerItem[] =>
  nodes.flatMap((node) => [
    { node, depth, parentId },
    ...(node.children ? buildLayerItems(node.children, depth + 1, node.id) : [])
  ]);

const layoutNodeTypes = new Set<Node['type']>([
  'container',
  'stack',
  'row',
  'column',
  'grid',
  'card',
  'section',
  'form'
]);

const layerTypeBadgeMap: Record<string, { label: string; icon?: string }> = {
  section: { label: 'Section', icon: '▦' },
  container: { label: 'Container', icon: '▣' },
  text: { label: 'Text', icon: 'T' },
  heading: { label: 'Heading', icon: 'H' },
  button: { label: 'Button', icon: '◉' },
  image: { label: 'Image', icon: '◩' },
  link: { label: 'Link', icon: '↗' },
  list: { label: 'List', icon: '≡' },
  input: { label: 'Input', icon: '⌨' },
  form: { label: 'Form', icon: '☰' },
  'component-instance': { label: 'Component', icon: '◇' }
};

const getLayerTypeBadge = (type: string): { label: string; icon?: string } => {
  if (layerTypeBadgeMap[type]) {
    return layerTypeBadgeMap[type];
  }

  return {
    label: type.charAt(0).toUpperCase() + type.slice(1)
  };
};

const styleFields = [
  { label: 'Text color', key: 'color', placeholder: '#f8fafc' },
  { label: 'Background', key: 'background', placeholder: '#0f172a' },
  { label: 'Font size', key: 'fontSize', placeholder: '16px' },
  { label: 'Padding', key: 'padding', placeholder: '12px 16px' },
  { label: 'Margin', key: 'margin', placeholder: '0' },
  { label: 'Border radius', key: 'borderRadius', placeholder: '12px' }
];

const resetStyleKeys = [
  'color',
  'background',
  'fontSize',
  'padding',
  'margin',
  'borderRadius',
  'backgroundColor',
  'fontWeight',
  'textAlign',
  'display',
  'justifyContent',
  'alignItems',
  'gridTemplateColumns',
  'width',
  'height',
  'gap'
];

type CanvasWidthPreset = 'narrow' | 'standard' | 'wide' | 'full';

const canvasWidthPresets: Array<{
  id: CanvasWidthPreset;
  label: string;
  className: string;
}> = [
  { id: 'narrow', label: 'Narrow', className: 'max-w-4xl' },
  { id: 'standard', label: 'Standard', className: 'max-w-6xl' },
  { id: 'wide', label: 'Wide', className: 'max-w-[96rem]' },
  { id: 'full', label: 'Full', className: 'max-w-none' }
];

const starterTemplateKeys = ['HeroCentered', 'FeatureRow', 'PricingMatrix'] as const;
const quickTemplateKeys = [
  'HeroCentered',
  'HeroSplit',
  'FeatureRow',
  'GalleryStrip',
  'PricingMatrix',
  'LeadCaptureForm',
  'AudiencePoll'
] as const;
const primitiveNodes: Array<{ type: Node['type']; label: string }> = [
  { type: 'section', label: 'Section' },
  { type: 'row', label: 'Row' },
  { type: 'column', label: 'Column' },
  { type: 'card', label: 'Card' },
  { type: 'text', label: 'Text' },
  { type: 'button', label: 'Button' },
  { type: 'image', label: 'Image' }
];
const primitiveNodeTypes = new Set<Node['type']>(primitiveNodes.map((item) => item.type));
const blockTemplateMimeType = 'application/x-block-template';
const primitiveNodeMimeType = 'application/x-node-primitive';

interface EditorLayoutProps {
  projects: ProjectSummary[];
  pages: Page[];
  activeProjectId: string | null;
  activePageId: string | null;
  assets: Asset[];
  componentFamilies: ComponentFamily[];
  isLoadingAssets?: boolean;
  isUploadingAsset?: boolean;
  assetError?: string | null;
  onUploadAsset: (file: File) => Promise<Asset | null>;
  onSelectProject: (projectId: string) => void;
  onSelectPage: (pageId: string) => void;
  onCreateProject: (name: string) => Promise<boolean>;
  onRenameProject: (projectId: string, name: string) => Promise<boolean>;
  onValidateProjectName: (
    name: string,
    projectId?: string | null
  ) => Promise<{ name: string; slug: string; available: boolean } | null>;
  onDeleteProject: (projectId: string) => void;
  onAddPage: () => void;
  onRenamePage: (pageId: string) => void;
  onDeletePage: (pageId: string) => void;
  isLoadingProjects?: boolean;
}

export default function EditorLayout({
  projects,
  pages,
  activeProjectId,
  activePageId,
  assets,
  componentFamilies,
  isLoadingAssets = false,
  isUploadingAsset = false,
  assetError = null,
  onUploadAsset,
  onSelectProject,
  onSelectPage,
  onCreateProject,
  onRenameProject,
  onValidateProjectName,
  onDeleteProject,
  onAddPage,
  onRenamePage,
  onDeletePage,
  isLoadingProjects = false
}: EditorLayoutProps) {
  const nodes = useEditorStore((state) => state.nodes);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const updateNodeProps = useEditorStore((state) => state.updateNodeProps);
  const updateNodeName = useEditorStore((state) => state.updateNodeName);
  const removeNode = useEditorStore((state) => state.removeNode);
  const addNode = useEditorStore((state) => state.addNode);
  const addNodeToContainer = useEditorStore((state) => state.addNodeToContainer);
  const setSelectedNodeId = useEditorStore((state) => state.setSelectedNodeId);
  const moveNodeWithinParent = useEditorStore((state) => state.moveNodeWithinParent);
  const gridSize = useEditorStore((state) => state.gridSize);
  const storeComponentFamilies = useEditorStore((state) => state.componentFamilies);
  const setComponentFamilies = useEditorStore((state) => state.setComponentFamilies);
  const updateNodeMetadata = useEditorStore((state) => state.updateNodeMetadata);
  const setGridSize = useEditorStore((state) => state.setGridSize);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const { cssVariables } = useTheme();
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isCanvasCentered, setIsCanvasCentered] = useState(true);
  const [canvasWidthPreset, setCanvasWidthPreset] = useState<CanvasWidthPreset>('wide');
  const [projectFormMode, setProjectFormMode] = useState<'create' | 'rename' | null>(
    null
  );
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [projectNameStatus, setProjectNameStatus] = useState<{
    state: 'idle' | 'checking' | 'available' | 'unavailable' | 'error';
    message?: string;
  }>({ state: 'idle' });
  const canvasBoundaryRef = useRef<HTMLDivElement | null>(null);
  const projectNameTimeout = useRef<number | null>(null);
  const projectValidationRequest = useRef(0);
  const projectNameInputRef = useRef<HTMLInputElement | null>(null);

  const selectedNode = useMemo(
    () => findNodeById(nodes, selectedNodeId),
    [nodes, selectedNodeId]
  );
  const selectedNodePath = useMemo(
    () => findNodePathById(nodes, selectedNodeId),
    [nodes, selectedNodeId]
  );
  const layerScopeNode = useMemo(() => {
    if (!selectedNodePath.length) {
      return null;
    }

    for (let index = selectedNodePath.length - 1; index >= 0; index -= 1) {
      const candidate = selectedNodePath[index];
      if (candidate.children?.length) {
        return candidate;
      }
    }

    return null;
  }, [selectedNodePath]);
  const layerItems = useMemo(() => {
    if (layerScopeNode) {
      return buildLayerItems([layerScopeNode]);
    }
    return buildLayerItems(nodes);
  }, [nodes, layerScopeNode]);
  const gridTemplateColumns = useMemo(
    () =>
      `${isLeftSidebarOpen ? 'minmax(220px,0.8fr)' : 'minmax(0,0)'} minmax(0,2fr) ${
        isRightSidebarOpen ? 'minmax(240px,0.9fr)' : 'minmax(0,0)'
      }`,
    [isLeftSidebarOpen, isRightSidebarOpen]
  );
  const gridGapClass = useMemo(() => {
    if (isLeftSidebarOpen && isRightSidebarOpen) {
      return 'gap-6';
    }
    if (isLeftSidebarOpen || isRightSidebarOpen) {
      return 'gap-3';
    }
    return 'gap-0';
  }, [isLeftSidebarOpen, isRightSidebarOpen]);
  const activeProjectName = useMemo(() => {
    if (!activeProjectId) {
      return '';
    }
    return projects.find((project) => project.id === activeProjectId)?.name ?? '';
  }, [activeProjectId, projects]);
  const selectedSchema = selectedNode ? getNodeSchema(selectedNode.type) : null;

  const replaceNodeById = (items: Node[], nodeId: string, replacement: Node): Node[] =>
    items.map((item) => {
      if (item.id === nodeId) {
        return replacement;
      }
      if (!item.children?.length) {
        return item;
      }
      return {
        ...item,
        children: replaceNodeById(item.children, nodeId, replacement)
      };
    });

  const handleSaveAsComponent = () => {
    if (!selectedNode) {
      return;
    }
    const seedName = `${selectedNode.name} / Default`;
    const response = window.prompt('Save as component (Family / Variant)', seedName)?.trim();
    if (!response) {
      return;
    }
    const [familyNameRaw, variantNameRaw] = response.split('/').map((item) => item.trim());
    const familyName = familyNameRaw || selectedNode.name;
    const variantName = variantNameRaw || 'Default';
    const now = new Date().toISOString();

    const existingFamily = storeComponentFamilies.find(
      (family) => family.name.toLowerCase() === familyName.toLowerCase()
    );
    const family: ComponentFamily = existingFamily
      ? {
          ...existingFamily,
          variants: [
            ...existingFamily.variants.filter(
              (variant) => variant.name.toLowerCase() !== variantName.toLowerCase()
            ),
            {
              id: createComponentId('variant'),
              name: variantName,
              rootNode: selectedNode,
              createdAt: now,
              updatedAt: now
            }
          ],
          updatedAt: now
        }
      : {
          id: createComponentId('family'),
          name: familyName,
          variants: [
            {
              id: createComponentId('variant'),
              name: variantName,
              rootNode: selectedNode,
              createdAt: now,
              updatedAt: now
            }
          ],
          createdAt: now,
          updatedAt: now
        };

    const nextFamilies = existingFamily
      ? storeComponentFamilies.map((item) => (item.id === family.id ? family : item))
      : [...storeComponentFamilies, family];
    setComponentFamilies(nextFamilies);
    const selectedVariant = family.variants[family.variants.length - 1];
    const instanceNode = createComponentInstanceNode(family, selectedVariant, selectedNode.name);
    useEditorStore.setState((state) => ({
      nodes: replaceNodeById(state.nodes, selectedNode.id, instanceNode),
      selectedNodeId: instanceNode.id
    }));
  };

  const selectedInstanceMetadata = selectedNode ? getComponentInstanceMetadata(selectedNode) : null;
  const selectedComponentFamily = selectedInstanceMetadata
    ? storeComponentFamilies.find((family) => family.id === selectedInstanceMetadata.familyId) ?? null
    : null;
  const selectedComponentVariant =
    selectedComponentFamily?.variants.find(
      (variant) => variant.id === selectedInstanceMetadata?.variantId
    ) ?? null;
  const componentOverrideFields = selectedComponentVariant
    ? collectComponentOverrideFields(selectedComponentVariant.rootNode)
    : [];

  const activeCanvasWidthPreset = useMemo(
    () => canvasWidthPresets.find((preset) => preset.id === canvasWidthPreset) ?? canvasWidthPresets[2],
    [canvasWidthPreset]
  );
  const canvasContentClassName = useMemo(() => {
    const centeredClassName = isCanvasCentered ? 'mx-auto' : '';
    return `w-full space-y-4 transition-all ${centeredClassName} ${activeCanvasWidthPreset.className}`.trim();
  }, [activeCanvasWidthPreset.className, isCanvasCentered]);

  useEffect(() => {
    if (JSON.stringify(componentFamilies) !== JSON.stringify(storeComponentFamilies)) {
      setComponentFamilies(componentFamilies);
    }
  }, [componentFamilies, setComponentFamilies, storeComponentFamilies]);

  const handleResetStyles = () => {
    if (!selectedNode) {
      return;
    }
    const resetPayload = Object.fromEntries(resetStyleKeys.map((key) => [key, '']));
    updateNodeProps(selectedNode.id, resetPayload);
  };
  const addNodeToBestTarget = (node: Node) => {
    const insertionTarget = [...selectedNodePath]
      .reverse()
      .find((candidate) => layoutNodeTypes.has(candidate.type));

    if (insertionTarget) {
      addNodeToContainer(insertionTarget.id, node);
      return;
    }

    addNode(node);
  };
  const handleAddBlock = (templateName: string) => {
    const template = blockTemplates.find((item) => item.key === templateName)?.template;
    if (!template) {
      return;
    }
    addNodeToBestTarget(buildNodeFromTemplate(template));
  };
  const handleAddPrimitive = (type: Node['type']) => {
    const schema = getNodeSchema(type);
    addNodeToBestTarget(
      buildNodeFromTemplate({
        type,
        name: schema?.defaultName ?? type,
        props: schema?.defaultProps ?? {}
      })
    );
  };
  const resolveDraggedPrimitiveType = (event: DragEvent<HTMLElement>): Node['type'] | null => {
    const rawType = event.dataTransfer.getData(primitiveNodeMimeType);
    if (!rawType) {
      return null;
    }
    if (!primitiveNodeTypes.has(rawType as Node['type'])) {
      return null;
    }
    return rawType as Node['type'];
  };
  const handlePrimitiveDragStart = (type: Node['type']) => (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData(primitiveNodeMimeType, type);
    event.dataTransfer.setData('text/plain', type);
    event.dataTransfer.effectAllowed = 'copy';
  };
  const handleBlockDragStart = (templateName: string) => (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData(blockTemplateMimeType, templateName);
    event.dataTransfer.setData('text/plain', templateName);
    event.dataTransfer.effectAllowed = 'copy';
  };
  const handleCanvasDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };
  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const draggedPrimitiveType = resolveDraggedPrimitiveType(event);
    if (draggedPrimitiveType) {
      handleAddPrimitive(draggedPrimitiveType);
      return;
    }
    const templateName =
      event.dataTransfer.getData(blockTemplateMimeType) ||
      event.dataTransfer.getData('text/plain');
    if (!templateName) {
      return;
    }
    const template = blockTemplates.find((item) => item.key === templateName)?.template;
    if (!template) {
      return;
    }
    addNode(buildNodeFromTemplate(template));
  };
  const handleLayerDragStart = (item: LayerItem) => (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/x-editor-node', item.node.id);
    event.dataTransfer.setData('application/x-editor-parent', item.parentId ?? 'root');
    event.dataTransfer.effectAllowed = 'move';
  };
  const handleLayerDragOver = (item: LayerItem) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourceParent = event.dataTransfer.getData('application/x-editor-parent');
    const targetParent = item.parentId ?? 'root';
    if (sourceParent && sourceParent !== targetParent) {
      event.dataTransfer.dropEffect = 'none';
      return;
    }
    event.dataTransfer.dropEffect = 'move';
  };
  const handleLayerDrop = (item: LayerItem) => (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('application/x-editor-node');
    const sourceParent = event.dataTransfer.getData('application/x-editor-parent');
    const targetParent = item.parentId ?? 'root';
    if (!sourceId || sourceParent !== targetParent || sourceId === item.node.id) {
      return;
    }
    moveNodeWithinParent(sourceParent === 'root' ? null : sourceParent, sourceId, item.node.id);
    setSelectedNodeId(sourceId);
  };
  const handleAssetUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const uploaded = await onUploadAsset(file);
    if (uploaded && selectedNode) {
      updateNodeProps(selectedNode.id, {
        src: uploaded.url,
        alt: uploaded.filename
      });
    }
    event.target.value = '';
  };
  const handleGridSizeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number.parseInt(event.target.value, 10);
    if (Number.isNaN(nextValue)) {
      setGridSize(4);
      return;
    }
    setGridSize(Math.max(4, Math.min(64, nextValue)));
  };
  const resetProjectForm = () => {
    setProjectFormMode(null);
    setProjectNameDraft('');
    setProjectNameStatus({ state: 'idle' });
  };
  const handleOpenProjectForm = (mode: 'create' | 'rename') => {
    if (mode === 'rename' && !activeProjectId) {
      return;
    }
    setProjectFormMode(mode);
    setProjectNameDraft(mode === 'rename' ? activeProjectName : '');
    setProjectNameStatus({ state: 'idle' });
  };
  const handleProjectSubmit = async () => {
    const trimmed = projectNameDraft.trim();
    if (!trimmed || projectNameStatus.state === 'unavailable') {
      return;
    }
    if (projectFormMode === 'create') {
      const success = await onCreateProject(trimmed);
      if (success) {
        resetProjectForm();
      }
    }
    if (projectFormMode === 'rename' && activeProjectId) {
      const success = await onRenameProject(activeProjectId, trimmed);
      if (success) {
        resetProjectForm();
      }
    }
  };

  useEffect(() => {
    if (!projectFormMode) {
      return;
    }
    projectNameInputRef.current?.focus();
  }, [projectFormMode]);

  useEffect(() => {
    if (!projectFormMode) {
      return;
    }
    if (projectNameTimeout.current) {
      window.clearTimeout(projectNameTimeout.current);
    }
    const trimmed = projectNameDraft.trim();
    if (!trimmed) {
      setProjectNameStatus({ state: 'idle' });
      return;
    }
    setProjectNameStatus({ state: 'checking' });
    projectNameTimeout.current = window.setTimeout(() => {
      const requestId = ++projectValidationRequest.current;
      void (async () => {
        const response = await onValidateProjectName(
          trimmed,
          projectFormMode === 'rename' ? activeProjectId : null
        );
        if (requestId !== projectValidationRequest.current) {
          return;
        }
        if (!response) {
          setProjectNameStatus({
            state: 'error',
            message: 'Unable to validate name.'
          });
          return;
        }
        setProjectNameStatus(
          response.available
            ? { state: 'available', message: 'Name is available.' }
            : { state: 'unavailable', message: 'Name is already taken.' }
        );
      })();
    }, 400);

    return () => {
      if (projectNameTimeout.current) {
        window.clearTimeout(projectNameTimeout.current);
      }
    };
  }, [activeProjectId, onValidateProjectName, projectFormMode, projectNameDraft]);

  useEffect(() => {
    if (projectFormMode === 'rename' && !activeProjectId) {
      resetProjectForm();
    }
  }, [activeProjectId, projectFormMode]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tagName = target.tagName.toLowerCase();
      return (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) {
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        if (!selectedNodeId) {
          return;
        }
        event.preventDefault();
        removeNode(selectedNodeId);
        return;
      }
      const isMac = navigator.platform.toLowerCase().includes('mac');
      const modifierPressed = isMac ? event.metaKey : event.ctrlKey;
      if (!modifierPressed) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if (key === 'y') {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [redo, removeNode, selectedNodeId, undo]);

  return (
    <section className="rounded-3xl border-neon-soft bg-black/80 p-6 shadow-2xl neon-glow-soft">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/80 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-transparent bg-neon-gradient bg-clip-text">
            Editor Workspace
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Drag, drop, and refine</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-300">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 rounded-full bg-neon-gradient shadow-lg neon-glow-soft" />
            Live Preview
          </div>
          <div className="flex items-center gap-2 text-[0.55rem] uppercase tracking-[0.2em] text-slate-400">
            <button
              type="button"
              onClick={() => setIsLeftSidebarOpen((prev) => !prev)}
              aria-pressed={isLeftSidebarOpen}
              className="rounded-full border border-slate-700/80 px-3 py-1 transition hover:border-cyan-400/60 hover:text-slate-200"
            >
              {isLeftSidebarOpen ? 'Hide left' : 'Show left'}
            </button>
            <button
              type="button"
              onClick={() => setIsRightSidebarOpen((prev) => !prev)}
              aria-pressed={isRightSidebarOpen}
              className="rounded-full border border-slate-700/80 px-3 py-1 transition hover:border-fuchsia-400/60 hover:text-slate-200"
            >
              {isRightSidebarOpen ? 'Hide right' : 'Show right'}
            </button>
          </div>
        </div>
      </header>

      <div
        className={`mt-6 grid min-h-0 transition-[grid-template-columns] duration-300 ${gridGapClass}`}
        style={{ gridTemplateColumns }}
      >
        <aside
          className={`flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-slate-900/80 bg-slate-950/70 transition-[width,opacity] duration-300 ${
            isLeftSidebarOpen
              ? 'w-full overflow-y-auto p-4 opacity-100'
              : 'w-0 border-transparent p-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
                Projects
              </h3>
              <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                {projects.length}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[0.6rem] uppercase tracking-[0.2em] text-slate-400">
              <button
                type="button"
                onClick={() => handleOpenProjectForm('create')}
                className="rounded-full border border-slate-700/80 px-3 py-1 transition hover:border-cyan-400/60 hover:text-slate-200"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => handleOpenProjectForm('rename')}
                disabled={!activeProjectId}
                className="rounded-full border border-slate-700/80 px-3 py-1 transition hover:border-cyan-400/60 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => activeProjectId && onDeleteProject(activeProjectId)}
                disabled={!activeProjectId}
                className="rounded-full border border-rose-500/60 px-3 py-1 text-rose-200 transition hover:border-rose-300/80 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete
              </button>
            </div>
            {projectFormMode ? (
              <form
                className="mt-3 space-y-3 rounded-lg border border-slate-900/80 bg-black/70 p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleProjectSubmit();
                }}
              >
                <label className="block text-[0.6rem] uppercase tracking-[0.2em] text-slate-400">
                  Project name
                  <input
                    ref={projectNameInputRef}
                    type="text"
                    value={projectNameDraft}
                    onChange={(event) => {
                      setProjectNameDraft(event.target.value);
                      setProjectNameStatus({ state: 'idle' });
                    }}
                    placeholder="New project name"
                    className="mt-2 w-full rounded-lg border border-slate-800/80 bg-black/60 px-3 py-2 text-xs normal-case text-slate-100 focus:border-cyan-200 focus:outline-none"
                  />
                </label>
                {projectNameStatus.state !== 'idle' ? (
                  <p
                    className={`text-[0.6rem] ${
                      projectNameStatus.state === 'available'
                        ? 'text-cyan-200'
                        : projectNameStatus.state === 'checking'
                          ? 'text-slate-400'
                          : 'text-rose-300'
                    }`}
                  >
                    {projectNameStatus.state === 'checking'
                      ? 'Checking availability...'
                      : projectNameStatus.message}
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2 text-[0.6rem] uppercase tracking-[0.2em]">
                  <button
                    type="submit"
                    disabled={
                      !projectNameDraft.trim() ||
                      projectNameStatus.state === 'unavailable' ||
                      projectNameStatus.state === 'error' ||
                      projectNameStatus.state === 'checking'
                    }
                    className="rounded-full border border-cyan-400/60 px-3 py-1 text-cyan-200 transition hover:border-cyan-200 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {projectFormMode === 'create' ? 'Create project' : 'Rename project'}
                  </button>
                  <button
                    type="button"
                    onClick={resetProjectForm}
                    className="rounded-full border border-slate-700/80 px-3 py-1 text-slate-300 transition hover:border-slate-400 hover:text-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : null}
            <div className="mt-3 space-y-2">
              {isLoadingProjects ? (
                <p className="text-xs text-slate-400">Loading projects...</p>
              ) : projects.length === 0 ? (
                <p className="text-xs text-slate-400">No projects yet.</p>
              ) : (
                projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onSelectProject(project.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
                      project.id === activeProjectId
                        ? 'border-cyan-300/70 bg-cyan-500/10 text-cyan-100'
                        : 'border-slate-900/80 bg-black/60 text-slate-300 hover:border-cyan-400/60 hover:text-slate-100'
                    }`}
                  >
                    <span className="truncate">{project.name}</span>
                    <span className="text-[0.6rem] text-slate-500">
                      {project.updatedAt
                        ? new Date(project.updatedAt).toLocaleDateString()
                        : '—'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
                Pages
              </h3>
              <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                {pages.length}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[0.6rem] uppercase tracking-[0.2em] text-slate-400">
              <button
                type="button"
                onClick={onAddPage}
                className="rounded-full border border-slate-700/80 px-3 py-1 transition hover:border-fuchsia-400/60 hover:text-slate-200"
              >
                Add page
              </button>
              <button
                type="button"
                onClick={() => activePageId && onRenamePage(activePageId)}
                disabled={!activePageId}
                className="rounded-full border border-slate-700/80 px-3 py-1 transition hover:border-fuchsia-400/60 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => activePageId && onDeletePage(activePageId)}
                disabled={!activePageId}
                className="rounded-full border border-rose-500/60 px-3 py-1 text-rose-200 transition hover:border-rose-300/80 hover:text-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Delete
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {pages.length === 0 ? (
                <p className="text-xs text-slate-400">No pages loaded.</p>
              ) : (
                pages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => onSelectPage(page.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition ${
                      page.id === activePageId
                        ? 'border-fuchsia-300/70 bg-fuchsia-500/10 text-fuchsia-100'
                        : 'border-slate-900/80 bg-black/60 text-slate-300 hover:border-fuchsia-400/60 hover:text-slate-100'
                    }`}
                  >
                    <span className="truncate">{page.title}</span>
                    <span className="text-[0.6rem] text-slate-500">{page.path}</span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-transparent bg-neon-gradient bg-clip-text">
              Blocks
            </h3>
            <span className="rounded-full border border-slate-700 px-2 py-1 text-[0.65rem] text-slate-300">
              {blockTemplates.length} items
            </span>
          </div>
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
            Click any block to add instantly. Drag/drop is optional.
          </div>
          <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
            <h4 className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-300">
              Structure primitives
            </h4>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {primitiveNodes.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => handleAddPrimitive(item.type)}
                  onDragStart={handlePrimitiveDragStart(item.type)}
                  draggable
                  className="rounded-lg border border-slate-800/80 bg-black/70 px-2 py-1.5 text-left text-xs text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-100"
                >
                  + {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {blockTemplates.map((block) => (
              <button
                key={block.key}
                type="button"
                onClick={() => handleAddBlock(block.key)}
                onDragStart={handleBlockDragStart(block.key)}
                draggable
                className="flex w-full items-center justify-between rounded-xl border border-slate-900/80 bg-black/60 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-transparent hover:bg-neon-gradient hover:text-slate-950 hover:neon-glow-soft"
              >
                <span>{block.label}</span>
                <span className="text-xs text-slate-400">+ add</span>
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-xl border border-slate-900/80 bg-black/60 p-3 text-xs text-slate-300">
            Tip: Drag blocks onto the canvas or into containers when you need precise placement.
          </div>
        </aside>

        <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border-neon bg-black/80 p-5 shadow-lg neon-glow-soft">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-transparent bg-neon-gradient bg-clip-text">
              Canvas
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-slate-700 px-2 py-1">Desktop</span>
              <span className="rounded-full border border-slate-700 px-2 py-1">100%</span>
              <button
                type="button"
                onClick={() => setIsCanvasCentered((prev) => !prev)}
                aria-pressed={isCanvasCentered}
                className={`rounded-full border px-2 py-1 text-[0.65rem] uppercase tracking-[0.2em] transition ${
                  isCanvasCentered
                    ? 'border-cyan-300/80 bg-cyan-500/10 text-cyan-100'
                    : 'border-slate-700 text-slate-300 hover:border-cyan-400/60 hover:text-slate-100'
                }`}
              >
                {isCanvasCentered ? 'Centered' : 'Center all'}
              </button>
              <label className="flex items-center gap-2 rounded-full border border-slate-700 px-2 py-1">
                <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-400">
                  Width
                </span>
                <select
                  value={canvasWidthPreset}
                  onChange={(event) =>
                    setCanvasWidthPreset(event.target.value as CanvasWidthPreset)
                  }
                  className="rounded-md border border-slate-700/80 bg-slate-950/80 px-2 py-1 text-xs text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
                >
                  {canvasWidthPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-full border border-slate-700 px-2 py-1">
                <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-400">
                  Grid
                </span>
                <input
                  type="number"
                  min={4}
                  max={64}
                  step={1}
                  value={gridSize}
                  onChange={handleGridSizeChange}
                  className="w-14 rounded-md border border-slate-700/80 bg-slate-950/80 px-2 py-1 text-xs text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
                />
                <span className="text-[0.6rem] text-slate-500">px</span>
              </label>
            </div>
          </div>
          <div
            className="relative flex-1 overflow-hidden rounded-2xl border-neon-soft bg-black/80 p-6"
            style={cssVariables}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            ref={canvasBoundaryRef}
            data-canvas-boundary
          >
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{
                backgroundImage:
                  'linear-gradient(to right, rgba(148, 163, 184, 0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.18) 1px, transparent 1px)',
                backgroundSize: `${gridSize}px ${gridSize}px`,
                opacity: 0.22
              }}
            />
            <div className="relative z-10 h-full">
              <div className="mb-4 flex flex-wrap gap-2 rounded-xl border border-slate-800/80 bg-black/70 p-2">
                <span className="px-2 py-1 text-[0.6rem] uppercase tracking-[0.2em] text-slate-400">
                  Quick insert
                </span>
                {quickTemplateKeys.map((key) => {
                  const block = blockTemplates.find((item) => item.key === key);
                  if (!block) {
                    return null;
                  }
                  return (
                    <button
                      key={block.key}
                      type="button"
                      onClick={() => handleAddBlock(block.key)}
                      className="rounded-full border border-slate-700/80 px-3 py-1 text-[0.65rem] uppercase tracking-[0.15em] text-slate-200 transition hover:border-cyan-400/60 hover:text-cyan-100"
                    >
                      + {block.label}
                    </button>
                  );
                })}
              </div>
              {nodes.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-slate-300">
                  <p className="text-sm text-slate-200">Start by clicking a layout below.</p>
                  <p className="text-xs text-slate-400">
                    You can still drag and drop, but one-click add is now the default flow.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {starterTemplateKeys.map((key) => {
                      const block = blockTemplates.find((item) => item.key === key);
                      if (!block) {
                        return null;
                      }
                      return (
                        <button
                          key={block.key}
                          type="button"
                          onClick={() => handleAddBlock(block.key)}
                          className="rounded-full bg-neon-gradient px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 transition hover:brightness-110 neon-glow-soft"
                        >
                          Add {block.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className={canvasContentClassName}>
                  {nodes.map((node) => (
                    <NodeRenderer key={node.id} node={node} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside
          className={`flex h-full min-h-0 min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-slate-900/80 bg-slate-950/70 transition-[width,opacity] duration-300 ${
            isRightSidebarOpen
              ? 'w-full overflow-y-auto p-4 opacity-100'
              : 'w-0 border-transparent p-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-300">
                Layers
              </h3>
              <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                {layerItems.length}
              </span>
            </div>
            {layerScopeNode ? (
              <p className="mt-2 text-[0.65rem] uppercase tracking-[0.18em] text-slate-500">
                Scoped to: {layerScopeNode.name}
              </p>
            ) : null}
            <div className="mt-3 space-y-1.5">
              {layerItems.length === 0 ? (
                <p className="text-xs text-slate-400">No layers yet.</p>
              ) : (
                layerItems.map((item) => {
                  const isSelected = selectedNodeId === item.node.id;
                  const typeBadge = getLayerTypeBadge(item.node.type);
                  return (
                    <div
                      key={item.node.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedNodeId(item.node.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          setSelectedNodeId(item.node.id);
                        }
                      }}
                      draggable
                      onDragStart={handleLayerDragStart(item)}
                      onDragOver={handleLayerDragOver(item)}
                      onDrop={handleLayerDrop(item)}
                      className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-xs transition ${
                        isSelected
                          ? 'border-cyan-300/70 bg-cyan-500/10 text-cyan-100'
                          : 'border-slate-900/80 bg-black/60 text-slate-300 hover:border-cyan-400/60'
                      }`}
                      style={{ paddingLeft: `${8 + item.depth * 12}px` }}
                    >
                      <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                        {typeBadge.icon ? `${typeBadge.icon} ` : ''}
                        {typeBadge.label}
                      </span>
                      <span className="flex-1 truncate text-slate-100">
                        {item.node.name}
                        {isComponentInstanceNode(item.node) ? (
                          <span className="ml-1 text-[0.55rem] uppercase tracking-[0.18em] text-cyan-300/80">
                            instance
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeNode(item.node.id);
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                          className="rounded-full border border-transparent px-2 py-1 text-[0.65rem] uppercase tracking-[0.2em] text-slate-500 transition hover:border-rose-400/60 hover:text-rose-200"
                          aria-label={`Delete ${item.node.name}`}
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-transparent bg-neon-gradient bg-clip-text">
              Inspector
            </h3>
            <span className="text-xs text-slate-400">
              {selectedNode ? selectedNode.name : 'No selection'}
            </span>
          </div>
          <NodeInspectorPanel
            selectedNode={selectedNode}
            selectedSchema={selectedSchema}
            assets={assets}
            isLoadingAssets={isLoadingAssets}
            isUploadingAsset={isUploadingAsset}
            assetError={assetError}
            onUploadAsset={handleAssetUpload}
            selectedComponentFamily={selectedComponentFamily}
            selectedComponentVariant={selectedComponentVariant}
            componentOverrideFields={componentOverrideFields}
            onSaveAsComponent={handleSaveAsComponent}
            onRenameNode={(node) => {
              const nextName = window.prompt('Rename selected layer', node.name);
              if (nextName?.trim()) {
                updateNodeName(node.id, nextName.trim());
              }
            }}
            onUpdateNodeProp={(nodeId, key, value) => {
              updateNodeProps(nodeId, { [key]: value });
            }}
            onUpdateComponentInstance={(nodeId, updates) => {
              updateNodeMetadata(nodeId, (metadata) => ({
                ...(metadata ?? {}),
                componentInstance: {
                  ...((metadata?.componentInstance as Record<string, NodePropValue> | undefined) ?? {}),
                  ...updates
                }
              }));
            }}
            onUpdateComponentOverride={(nodeId, overrideKey, value) => {
              updateNodeMetadata(nodeId, (metadata) => {
                const existing = (metadata?.componentInstance as { overrides?: Record<string, NodePropValue> } | undefined) ?? undefined;
                return {
                  ...(metadata ?? {}),
                  componentInstance: {
                    ...(existing ?? {}),
                    overrides: {
                      ...(existing?.overrides ?? {}),
                      [overrideKey]: value
                    }
                  }
                };
              });
            }}
          />
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <button
              className="rounded-full border-neon-soft px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:brightness-110"
              onClick={handleResetStyles}
              type="button"
              disabled={!selectedNodeId}
            >
              Reset styles
            </button>
            <button
              className="rounded-full border border-rose-500/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-100 transition hover:border-rose-300/80 hover:text-rose-50"
              onClick={() => selectedNode && removeNode(selectedNode.id)}
              type="button"
              disabled={!selectedNodeId}
            >
              Delete
            </button>
          </div>
        </aside>
      </div>
    </section>
  );
}
