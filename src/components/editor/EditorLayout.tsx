import { useMemo, type ChangeEvent } from 'react';

import type { Asset, Node, Page, ProjectSummary } from '../../models';
import { useEditorStore } from '../../store/editorStore';
import ColorControl from './ColorControl';
import NodeRenderer from './NodeRenderer';
import { blockTemplates, buildNodeFromTemplate } from './templates';
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

const styleFields = [
  { label: 'Text color', key: 'color', placeholder: '#f8fafc' },
  { label: 'Background', key: 'background', placeholder: '#0f172a' },
  { label: 'Font size', key: 'fontSize', placeholder: '16px' },
  { label: 'Padding', key: 'padding', placeholder: '12px 16px' },
  { label: 'Margin', key: 'margin', placeholder: '0' },
  { label: 'Border radius', key: 'borderRadius', placeholder: '12px' },
  { label: 'Gap', key: 'gap', placeholder: '12px' },
  { label: 'Width', key: 'width', placeholder: 'auto' },
  { label: 'Height', key: 'height', placeholder: 'auto' }
];

const colorFieldKeys = new Set(['color', 'background']);

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

const resetStyleKeys = [
  ...styleFields.map((field) => field.key),
  ...styleSelectFields.map((field) => field.key),
  ...containerStyleFields.map((field) => field.key)
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
  const addNode = useEditorStore((state) => state.addNode);
  const { tokens, updateTokenValue, cssVariables } = useTheme();

  const selectedNode = useMemo(
    () => findNodeById(nodes, selectedNodeId),
    [nodes, selectedNodeId]
  );
  const textKey = selectedNode?.type === 'button' ? 'label' : 'content';
  const textValue = selectedNode?.props?.[textKey] ?? '';
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

  return (
    <section className="rounded-3xl border-neon-soft bg-black/80 p-6 shadow-2xl neon-glow-soft">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/80 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-transparent bg-neon-gradient bg-clip-text">
            Editor Workspace
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Drag, drop, and refine</h2>
        </div>
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-300">
          <span className="h-2 w-2 rounded-full bg-neon-gradient shadow-lg neon-glow-soft" />
          Live Preview
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)_minmax(240px,0.9fr)]">
        <aside className="flex h-full flex-col gap-4 rounded-2xl border border-slate-900/80 bg-slate-950/70 p-4">
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
                className="flex w-full items-center justify-between rounded-xl border border-slate-900/80 bg-black/60 px-3 py-2 text-left text-sm text-slate-200 transition hover:border-transparent hover:bg-neon-gradient hover:text-slate-950 hover:neon-glow-soft"
              >
                <span>{block.label}</span>
                <span className="text-xs text-slate-400">+ add</span>
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-xl border border-slate-900/80 bg-black/60 p-3 text-xs text-slate-300">
            Tip: Drag blocks onto the canvas to compose your page.
          </div>
        </aside>

        <div className="flex h-full flex-col gap-4 rounded-2xl border-neon bg-black/80 p-5 shadow-lg neon-glow-soft">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-transparent bg-neon-gradient bg-clip-text">
              Canvas
            </h3>
            <div className="flex gap-2 text-xs text-slate-300">
              <span className="rounded-full border border-slate-700 px-2 py-1">Desktop</span>
              <span className="rounded-full border border-slate-700 px-2 py-1">100%</span>
            </div>
          </div>
          <div
            className="flex-1 rounded-2xl border-neon-soft bg-black/80 p-6"
            style={cssVariables}
          >
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

        <aside className="flex h-full flex-col gap-4 rounded-2xl border border-slate-900/80 bg-slate-950/70 p-4">
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
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Text</p>
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
              )}
              <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Style</p>
                <div className="mt-3 space-y-3">
                  {styleFields.map((field) => (
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
                  {styleSelectFields.map((field) => (
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
                  ))}
                  {selectedNode.type === 'container'
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
              {selectedNode.type === 'image' && (
                <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Assets</p>
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
              )}
              <div className="rounded-xl border border-slate-900/80 bg-black/60 p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Theme</p>
                <div className="mt-3 space-y-3">
                  {tokens.length > 0 ? (
                    tokens.map((token) => (
                      <div key={token.name} className="block">
                        {token.category === 'color' ? (
                          <ColorControl
                            label={token.name}
                            value={token.value}
                            onChange={(nextValue) => updateTokenValue(token.name, nextValue)}
                            description={token.description}
                          />
                        ) : (
                          <label className="block">
                            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-slate-500">
                              {token.name}
                            </span>
                            <input
                              value={token.value}
                              onChange={(event) => updateTokenValue(token.name, event.target.value)}
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
                    <p className="text-xs text-slate-500">No theme tokens loaded yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-800/80 bg-slate-950/40 p-4 text-xs uppercase tracking-[0.2em] text-slate-400">
              Select a node on the canvas to edit its text and styles.
            </div>
          )}
          <button
            className="mt-auto rounded-full border-neon-soft px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-100 transition hover:brightness-110"
            onClick={handleResetStyles}
            type="button"
            disabled={!selectedNodeId}
          >
            Reset styles
          </button>
        </aside>
      </div>
    </section>
  );
}
