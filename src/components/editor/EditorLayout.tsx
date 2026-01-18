import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from 'react';

import type { Asset, Node, Page, ProjectSummary } from '../../models';
import { useEditorStore } from '../../store/editorStore';
import ColorControl from './ColorControl';
import NodeRenderer from './NodeRenderer';
import { blockTemplates, buildNodeFromTemplate } from './templates';
import { themePresets } from './themePresets';
import { useTheme } from './ThemeProvider';

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

const styleFields = [
  { label: 'Text color', key: 'color', placeholder: '#f8fafc' },
  { label: 'Background', key: 'background', placeholder: '#0f172a' },
  { label: 'Font size', key: 'fontSize', placeholder: '16px' },
  { label: 'Padding', key: 'padding', placeholder: '12px 16px' },
  { label: 'Margin', key: 'margin', placeholder: '0' },
  { label: 'Border radius', key: 'borderRadius', placeholder: '12px' }
];

const colorFieldKeys = new Set(['color', 'background']);
const minimalStyleFieldKeys = new Set(['color', 'background', 'padding', 'margin']);
const minimalStyleFields = styleFields.filter((field) =>
  minimalStyleFieldKeys.has(field.key)
);

const styleSelectFields = [
  {
    label: 'Font weight',
    key: 'fontWeight',
    options: [
      { label: 'Default', value: '' },
      { label: 'Light (300)', value: '300' },
      { label: 'Regular (400)', value: '400' },
      { label: 'Medium (500)', value: '500' },
      { label: 'Semibold (600)', value: '600' },
      { label: 'Bold (700)', value: '700' }
    ]
  },
  {
    label: 'Text align',
    key: 'textAlign',
    options: [
      { label: 'Default', value: '' },
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
      { label: 'Justify', value: 'justify' }
    ]
  },
  {
    label: 'Display',
    key: 'display',
    options: [
      { label: 'Default', value: '' },
      { label: 'Block', value: 'block' },
      { label: 'Inline block', value: 'inline-block' },
      { label: 'Flex', value: 'flex' },
      { label: 'Grid', value: 'grid' },
      { label: 'None', value: 'none' }
    ]
  },
  {
    label: 'Justify content',
    key: 'justifyContent',
    options: [
      { label: 'Default', value: '' },
      { label: 'Start', value: 'flex-start' },
      { label: 'Center', value: 'center' },
      { label: 'End', value: 'flex-end' },
      { label: 'Space between', value: 'space-between' },
      { label: 'Space around', value: 'space-around' },
      { label: 'Space evenly', value: 'space-evenly' }
    ]
  },
  {
    label: 'Align items',
    key: 'alignItems',
    options: [
      { label: 'Default', value: '' },
      { label: 'Stretch', value: 'stretch' },
      { label: 'Start', value: 'flex-start' },
      { label: 'Center', value: 'center' },
      { label: 'End', value: 'flex-end' },
      { label: 'Baseline', value: 'baseline' }
    ]
  }
];

const containerStyleFields = [
  {
    label: 'Grid columns',
    key: 'gridTemplateColumns',
    placeholder: 'repeat(3, minmax(0, 1fr))'
  }
];

const layoutFields = [
  { label: 'Width', key: 'width', placeholder: 'auto' },
  { label: 'Height', key: 'height', placeholder: 'auto' }
];

const containerLayoutFields = [{ label: 'Gap', key: 'gap', placeholder: '12px' }];

const resetStyleKeys = [
  ...styleFields.map((field) => field.key),
  ...styleSelectFields.map((field) => field.key),
  ...containerStyleFields.map((field) => field.key),
  ...layoutFields.map((field) => field.key),
  ...containerLayoutFields.map((field) => field.key)
];

interface EditorLayoutProps {
  projects: ProjectSummary[];
  pages: Page[];
  activeProjectId: string | null;
  activePageId: string | null;
  assets: Asset[];
  isLoadingAssets?: boolean;
  isUploadingAsset?: boolean;
  assetError?: string | null;
  onUploadAsset: (file: File) => Promise<Asset | null>;
  onSelectProject: (projectId: string) => void;
  onSelectPage: (pageId: string) => void;
  isLoadingProjects?: boolean;
}

export default function EditorLayout({
  projects,
  pages,
  activeProjectId,
  activePageId,
  assets,
  isLoadingAssets = false,
  isUploadingAsset = false,
  assetError = null,
  onUploadAsset,
  onSelectProject,
  onSelectPage,
  isLoadingProjects = false
}: EditorLayoutProps) {
  const nodes = useEditorStore((state) => state.nodes);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const updateNodeProps = useEditorStore((state) => state.updateNodeProps);
  const updateNodeName = useEditorStore((state) => state.updateNodeName);
  const removeNode = useEditorStore((state) => state.removeNode);
  const addNode = useEditorStore((state) => state.addNode);
  const setSelectedNodeId = useEditorStore((state) => state.setSelectedNodeId);
  const moveNodeWithinParent = useEditorStore((state) => state.moveNodeWithinParent);
  const gridSize = useEditorStore((state) => state.gridSize);
  const setGridSize = useEditorStore((state) => state.setGridSize);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const { tokens, updateTokenValue, applyTokens, cssVariables } = useTheme();
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isThemeAdvanced, setIsThemeAdvanced] = useState(false);
  const [preserveThemeValues, setPreserveThemeValues] = useState(false);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [isStyleAdvanced, setIsStyleAdvanced] = useState(false);
  const [inspectorSections, setInspectorSections] = useState({
    text: true,
    style: true,
    layout: false,
    assets: false,
    theme: false
  });

  const selectedNode = useMemo(
    () => findNodeById(nodes, selectedNodeId),
    [nodes, selectedNodeId]
  );
  const layerItems = useMemo(() => buildLayerItems(nodes), [nodes]);
  const gridTemplateColumns = useMemo(
    () =>
      `${isLeftSidebarOpen ? 'minmax(220px,0.8fr)' : 'minmax(0,0)'} minmax(0,2fr) ${
        isRightSidebarOpen ? 'minmax(240px,0.9fr)' : 'minmax(0,0)'
      }`,
    [isLeftSidebarOpen, isRightSidebarOpen]
  );
  const textKey = selectedNode?.type === 'button' ? 'label' : 'content';
  const textValue = selectedNode?.props?.[textKey] ?? '';
  const isLayoutNode = selectedNode?.type === 'container' || selectedNode?.type === 'section';
  const toggleInspectorSection = (section: keyof typeof inspectorSections) => {
    setInspectorSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  const handleResetStyles = () => {
    if (!selectedNode) {
      return;
    }
    const resetPayload = Object.fromEntries(resetStyleKeys.map((key) => [key, '']));
    updateNodeProps(selectedNode.id, resetPayload);
  };
  const handleAddBlock = (templateName: string) => {
    const template = blockTemplates.find((item) => item.key === templateName)?.template;
    if (!template) {
      return;
    }
    addNode(buildNodeFromTemplate(template));
  };
  const handleBlockDragStart = (templateName: string) => (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.setData('application/x-block-template', templateName);
    event.dataTransfer.setData('text/plain', templateName);
    event.dataTransfer.effectAllowed = 'copy';
  };
  const handleCanvasDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };
  const handleCanvasDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const templateName =
      event.dataTransfer.getData('application/x-block-template') ||
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
  const handleAssetSelect = (asset: Asset) => {
    if (!selectedNode) {
      return;
    }
    updateNodeProps(selectedNode.id, {
      src: asset.url,
      alt: asset.filename
    });
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
  const handleApplyPreset = (presetId: string) => {
    const preset = themePresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }
    applyTokens(preset.tokens, { preserveExistingValues: preserveThemeValues });
    setActivePresetId(presetId);
  };

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
        className="mt-6 grid min-h-0 gap-6 transition-[grid-template-columns] duration-300"
        style={{ gridTemplateColumns }}
      >
        <aside
          className={`flex h-full min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-900/80 bg-slate-950/70 p-4 transition-opacity duration-300 ${
            isLeftSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
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
              12 items
            </span>
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
            Tip: Drag blocks onto the canvas or into containers to nest layouts.
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
            className="relative flex-1 rounded-2xl border-neon-soft bg-black/80 p-6"
            style={cssVariables}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
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
              {nodes.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-slate-300">
                  <p className="text-sm">Drop components here to start building.</p>
                  <button
                    type="button"
                    onClick={() => handleAddBlock('Hero')}
                    className="rounded-full bg-neon-gradient px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 neon-glow-soft"
                  >
                    Add section
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {nodes.map((node) => (
                    <NodeRenderer key={node.id} node={node} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <aside
          className={`flex h-full min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-900/80 bg-slate-950/70 p-4 transition-opacity duration-300 ${
            isRightSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
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
            <div className="mt-3 space-y-2">
              {layerItems.length === 0 ? (
                <p className="text-xs text-slate-400">No layers yet.</p>
              ) : (
                layerItems.map((item) => {
                  const isSelected = selectedNodeId === item.node.id;
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
                      className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-left text-xs transition ${
                        isSelected
                          ? 'border-cyan-300/70 bg-cyan-500/10 text-cyan-100'
                          : 'border-slate-900/80 bg-black/60 text-slate-300 hover:border-cyan-400/60'
                      }`}
                      style={{ paddingLeft: `${8 + item.depth * 12}px` }}
                    >
                      <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                        {item.node.type}
                      </span>
                      <input
                        value={item.node.name}
                        onChange={(event) => updateNodeName(item.node.id, event.target.value)}
                        onClick={(event) => event.stopPropagation()}
                        onFocus={() => setSelectedNodeId(item.node.id)}
                        className="flex-1 rounded-md border border-slate-800/80 bg-slate-950/70 px-2 py-1 text-xs text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
                      />
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
          {selectedNode ? (
            <div className="space-y-4 text-sm text-slate-200">
              {(selectedNode.type === 'text' || selectedNode.type === 'button') && (
                <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
                  <button
                    type="button"
                    onClick={() => toggleInspectorSection('text')}
                    className="flex w-full items-center justify-between text-left"
                    aria-expanded={inspectorSections.text}
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Text</p>
                    <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                      {inspectorSections.text ? 'Collapse' : 'Expand'}
                    </span>
                  </button>
                  <div
                    className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
                      inspectorSections.text ? 'max-h-[200px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <label className="mt-3 block text-xs uppercase tracking-[0.2em] text-slate-500">
                      Content
                    </label>
                    <input
                      value={textValue}
                      onChange={(event) =>
                        updateNodeProps(selectedNode.id, {
                          [textKey]: event.target.value
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
                      placeholder="Edit text"
                    />
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
                <button
                  type="button"
                  onClick={() => toggleInspectorSection('style')}
                  className="flex w-full items-center justify-between text-left"
                  aria-expanded={inspectorSections.style}
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Style</p>
                  <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                    {inspectorSections.style ? 'Collapse' : 'Expand'}
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
                    inspectorSections.style
                      ? 'max-h-[700px] opacity-100'
                      : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                      Essential styles
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsStyleAdvanced((prev) => !prev)}
                      className="rounded-full border border-slate-700/80 px-2 py-1 text-[0.55rem] uppercase tracking-[0.2em] text-slate-400 transition hover:border-cyan-400/60 hover:text-slate-200"
                    >
                      {isStyleAdvanced ? 'Hide advanced' : 'Advanced styles'}
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {(isStyleAdvanced ? styleFields : minimalStyleFields).map((field) => (
                      <div key={field.key} className="block">
                        {colorFieldKeys.has(field.key) ? (
                          <ColorControl
                            label={field.label}
                            value={selectedNode.props?.[field.key] ?? ''}
                            onChange={(nextValue) =>
                              updateNodeProps(selectedNode.id, {
                                [field.key]: nextValue
                              })
                            }
                          />
                        ) : (
                          <label className="block">
                            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                              {field.label}
                            </span>
                            <input
                              value={selectedNode.props?.[field.key] ?? ''}
                              onChange={(event) =>
                                updateNodeProps(selectedNode.id, {
                                  [field.key]: event.target.value
                                })
                              }
                              placeholder={field.placeholder}
                              className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
                            />
                          </label>
                        )}
                      </div>
                    ))}
                    {isStyleAdvanced
                      ? styleSelectFields.map((field) => (
                          <label key={field.key} className="block">
                            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                              {field.label}
                            </span>
                            <select
                              value={selectedNode.props?.[field.key] ?? ''}
                              onChange={(event) =>
                                updateNodeProps(selectedNode.id, {
                                  [field.key]: event.target.value
                                })
                              }
                              className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
                            >
                              {field.options.map((option) => (
                                <option key={option.value || 'default'} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))
                      : null}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
                <button
                  type="button"
                  onClick={() => toggleInspectorSection('layout')}
                  className="flex w-full items-center justify-between text-left"
                  aria-expanded={inspectorSections.layout}
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Layout</p>
                  <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                    {inspectorSections.layout ? 'Collapse' : 'Expand'}
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
                    inspectorSections.layout
                      ? 'max-h-[500px] opacity-100'
                      : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="mt-3 space-y-3">
                    {layoutFields.map((field) => (
                      <label key={field.key} className="block">
                        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                          {field.label}
                        </span>
                        <input
                          value={selectedNode.props?.[field.key] ?? ''}
                          onChange={(event) =>
                            updateNodeProps(selectedNode.id, {
                              [field.key]: event.target.value
                            })
                          }
                          placeholder={field.placeholder}
                          className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
                        />
                      </label>
                    ))}
                    {isLayoutNode
                      ? containerLayoutFields.map((field) => (
                          <label key={field.key} className="block">
                            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                              {field.label}
                            </span>
                            <input
                              value={selectedNode.props?.[field.key] ?? ''}
                              onChange={(event) =>
                                updateNodeProps(selectedNode.id, {
                                  [field.key]: event.target.value
                                })
                              }
                              placeholder={field.placeholder}
                              className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
                            />
                          </label>
                        ))
                      : null}
                    {isLayoutNode
                      ? containerStyleFields.map((field) => (
                          <label key={field.key} className="block">
                            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                              {field.label}
                            </span>
                            <input
                              value={selectedNode.props?.[field.key] ?? ''}
                              onChange={(event) =>
                                updateNodeProps(selectedNode.id, {
                                  [field.key]: event.target.value
                                })
                              }
                              placeholder={field.placeholder}
                              className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
                            />
                          </label>
                        ))
                      : null}
                  </div>
                </div>
              </div>
              {selectedNode.type === 'image' && (
                <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
                  <button
                    type="button"
                    onClick={() => toggleInspectorSection('assets')}
                    className="flex w-full items-center justify-between text-left"
                    aria-expanded={inspectorSections.assets}
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Assets</p>
                    <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                      {inspectorSections.assets ? 'Collapse' : 'Expand'}
                    </span>
                  </button>
                  <div
                    className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
                      inspectorSections.assets
                        ? 'max-h-[600px] opacity-100'
                        : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="mt-3 space-y-3">
                      <label className="block">
                        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                          Upload image
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAssetUpload}
                          disabled={isUploadingAsset}
                          className="mt-2 block w-full text-xs text-slate-300 file:mr-3 file:rounded-full file:border-0 file:bg-neon-gradient file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-950 file:shadow-lg file:neon-glow-soft disabled:opacity-60"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                          Alt text
                        </span>
                        <input
                          value={selectedNode.props?.alt ?? ''}
                          onChange={(event) =>
                            updateNodeProps(selectedNode.id, {
                              alt: event.target.value
                            })
                          }
                          placeholder="Describe the image"
                          className="mt-2 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
                        />
                      </label>
                      {assetError ? (
                        <p className="text-xs text-rose-300">Error: {assetError}</p>
                      ) : null}
                      {isLoadingAssets ? (
                        <p className="text-xs text-slate-500">Loading assets...</p>
                      ) : assets.length === 0 ? (
                        <p className="text-xs text-slate-500">No assets uploaded yet.</p>
                      ) : (
                        <div className="grid gap-2">
                          {assets.map((asset) => (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => handleAssetSelect(asset)}
                              className={`flex items-center gap-3 rounded-lg border px-2 py-2 text-left text-xs transition ${
                                asset.url === selectedNode.props?.src
                                  ? 'border-cyan-300/70 bg-cyan-500/10 text-cyan-100'
                                  : 'border-slate-800/80 bg-black/60 text-slate-300 hover:border-cyan-400/60'
                              }`}
                            >
                              <img
                                src={asset.url}
                                alt={asset.filename}
                                className="h-10 w-10 rounded-md border border-slate-800 object-cover"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-slate-100">
                                  {asset.filename}
                                </p>
                                <p className="text-[0.6rem] text-slate-500">
                                  {asset.createdAt
                                    ? new Date(asset.createdAt).toLocaleString()
                                    : '—'}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
                <button
                  type="button"
                  onClick={() => toggleInspectorSection('theme')}
                  className="flex w-full items-center justify-between text-left"
                  aria-expanded={inspectorSections.theme}
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Theme</p>
                  <span className="text-[0.6rem] uppercase tracking-[0.2em] text-slate-500">
                    {inspectorSections.theme ? 'Collapse' : 'Expand'}
                  </span>
                </button>
                <div
                  className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
                    inspectorSections.theme
                      ? 'max-h-[900px] opacity-100'
                      : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      Apply a preset or fine-tune the tokens below.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsThemeAdvanced((prev) => !prev)}
                      className="rounded-full border border-slate-700/80 px-2 py-1 text-[0.55rem] uppercase tracking-[0.2em] text-slate-400 transition hover:border-cyan-400/60 hover:text-slate-200"
                    >
                      {isThemeAdvanced ? 'Hide advanced' : 'Advanced styles'}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {themePresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyPreset(preset.id)}
                        className={`flex flex-col rounded-lg border px-3 py-2 text-left text-xs transition ${
                          activePresetId === preset.id
                            ? 'border-fuchsia-300/70 bg-fuchsia-500/10 text-fuchsia-100'
                            : 'border-slate-900/80 bg-black/60 text-slate-300 hover:border-fuchsia-400/60'
                        }`}
                      >
                        <span className="text-sm font-semibold text-slate-100">
                          {preset.name}
                        </span>
                        <span className="mt-1 text-[0.65rem] text-slate-500">
                          {preset.description}
                        </span>
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                    <input
                      type="checkbox"
                      checked={preserveThemeValues}
                      onChange={(event) => setPreserveThemeValues(event.target.checked)}
                      className="h-4 w-4 rounded border border-slate-600 bg-slate-950/80 text-cyan-400 focus:neon-ring"
                    />
                    Preserve custom values
                  </label>
                  <div className="mt-3 space-y-3">
                    {isThemeAdvanced ? (
                      tokens.length > 0 ? (
                        tokens.map((token) => (
                          <div key={token.name} className="block">
                            {token.category === 'color' ? (
                              <ColorControl
                                label={token.name}
                                value={token.value}
                                onChange={(nextValue) =>
                                  updateTokenValue(token.name, nextValue)
                                }
                                description={token.description}
                              />
                            ) : (
                              <label className="block">
                                <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                                  {token.name}
                                </span>
                                <input
                                  value={token.value}
                                  onChange={(event) =>
                                    updateTokenValue(token.name, event.target.value)
                                  }
                                  className="mt-1 w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 focus:border-transparent focus:outline-none focus:neon-ring"
                                  placeholder={token.description ?? 'Theme token value'}
                                />
                                {token.description ? (
                                  <span className="mt-2 block text-[0.65rem] text-slate-500">
                                    {token.description}
                                  </span>
                                ) : null}
                              </label>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-500">
                          No theme tokens loaded yet.
                        </p>
                      )
                    ) : (
                      <p className="text-xs text-slate-500">
                        Advanced tokens are hidden. Toggle to edit individual values.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800/80 bg-slate-950/40 p-4 text-xs uppercase tracking-[0.2em] text-slate-400">
              Select a node on the canvas to edit its text and styles.
            </div>
          )}
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
