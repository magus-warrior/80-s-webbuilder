import type {
  CSSProperties,
  DragEvent,
  FocusEvent,
  FormEvent,
  HTMLAttributes,
  MouseEvent
} from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import interact from 'interactjs';

import type { Node } from '../../models';
import { useEditorStore } from '../../store/editorStore';
import { getNodePropAsString, getNodeSchema } from './nodeSchemas';
import { blockTemplates, buildNodeFromTemplate } from './templates';
import { isComponentInstanceNode, resolveComponentInstanceNode } from './componentInstances';
import { useTheme } from './ThemeProvider';

type NodeRendererProps = {
  node: Node;
  parentId?: string | null;
  interactive?: boolean;
  disableVisualStyles?: boolean;
  publicSlug?: string | null;
};

const stylePropHandlers: Record<
  string,
  (value: string | number, style: CSSProperties) => void
> = {
  color: (value, style) => {
    style.color = value;
  },
  background: (value, style) => {
    style.background = value;
  },
  backgroundColor: (value, style) => {
    if (value.includes('gradient')) {
      style.background = value;
    } else {
      style.backgroundColor = value;
    }
  },
  fontSize: (value, style) => {
    style.fontSize = value;
  },
  fontWeight: (value, style) => {
    style.fontWeight = value;
  },
  fontFamily: (value, style) => {
    style.fontFamily = value;
  },
  textAlign: (value, style) => {
    style.textAlign = value as CSSProperties['textAlign'];
  },
  padding: (value, style) => {
    style.padding = value;
  },
  margin: (value, style) => {
    style.margin = value;
  },
  borderRadius: (value, style) => {
    style.borderRadius = value;
  },
  gap: (value, style) => {
    style.gap = value;
  },
  width: (value, style) => {
    style.width = value;
  },
  height: (value, style) => {
    style.height = value;
  },
  display: (value, style) => {
    style.display = value as CSSProperties['display'];
  },
  justifyContent: (value, style) => {
    style.justifyContent = value as CSSProperties['justifyContent'];
  },
  alignItems: (value, style) => {
    style.alignItems = value as CSSProperties['alignItems'];
  },
  flexWrap: (value, style) => {
    style.flexWrap = value as CSSProperties['flexWrap'];
  },
  alignContent: (value, style) => {
    style.alignContent = value as CSSProperties['alignContent'];
  },
  gridTemplateColumns: (value, style) => {
    style.gridTemplateColumns = value;
  }
};

const normalizeTokenName = (value: string) =>
  value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');

const buildTokenVarMap = (tokens: { name: string }[]) =>
  tokens.reduce<Record<string, string>>((map, token) => {
    const normalized = normalizeTokenName(token.name);
    if (normalized) {
      map[normalized] = `var(--theme-${normalized})`;
    }
    return map;
  }, {});

const resolveTokenValue = (value: string, tokenMap: Record<string, string>) => {
  const trimmed = value.trim();
  if (trimmed.startsWith('var(')) {
    return value;
  }
  const normalized = normalizeTokenName(trimmed);
  return tokenMap[normalized] ?? value;
};

const readBooleanNodeProp = (node: Node, key: string, fallback: boolean): boolean => {
  const value = node.props?.[key];
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return fallback;
};

const visualStyleProps = new Set([
  'color',
  'background',
  'backgroundColor',
  'fontSize',
  'fontWeight',
  'textAlign'
]);

const resolveNodeStyles = (
  node: Node,
  tokenMap: Record<string, string>,
  disableVisualStyles = false,
  _interactive = true
): CSSProperties => {
  const style: CSSProperties = {};
  const props = node.props ?? {};
  const toCamelCase = (key: string) =>
    key.replace(/[-_]+([a-z])/gi, (_, letter: string) => letter.toUpperCase());

  Object.entries(props).forEach(([key, value]) => {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return;
    }
    const normalizedKey = toCamelCase(key);
    if (disableVisualStyles && visualStyleProps.has(normalizedKey)) {
      return;
    }
    const handler = stylePropHandlers[normalizedKey];
    if (handler) {
      const resolvedValue =
        typeof value === 'string' ? resolveTokenValue(value, tokenMap) : value;
      if (
        disableVisualStyles &&
        visualStyleProps.has(normalizedKey) &&
        typeof resolvedValue === 'string' &&
        !resolvedValue.trim().startsWith('var(--theme-')
      ) {
        return;
      }
      handler(resolvedValue, style);
      return;
    }

    const fallbackValue =
      typeof value === 'string' ? resolveTokenValue(value, tokenMap) : value;
    (style as Record<string, string | number>)[normalizedKey] = fallbackValue;
  });

  return resolveLayoutStyle(node, style);
};


const layoutNodeTypes = new Set(['container', 'stack', 'row', 'column', 'grid', 'card', 'section']);

const resolveLayoutStyle = (
  node: Node,
  style: CSSProperties
): CSSProperties => {
  const nextStyle: CSSProperties = { ...style };
  const props = node.props ?? {};
  const columns = Number.parseInt(String(props.columns ?? ''), 10);
  const minColumnWidth = getNodePropAsString(node, 'minColumnWidth') || `${getResponsiveColumnMinWidth(columns || 1)}px`;

  if (node.type === 'container' || node.type === 'grid') {
    const safeColumns = Number.isNaN(columns) || columns < 1 ? 1 : columns;
    nextStyle.display = 'grid';
    nextStyle.gap = nextStyle.gap ?? '1rem';
    nextStyle.gridTemplateColumns =
      safeColumns <= 1
        ? 'minmax(0, 1fr)'
        : `repeat(auto-fit, minmax(min(100%, ${minColumnWidth}), 1fr))`;
    nextStyle.alignItems = nextStyle.alignItems ?? 'stretch';
    nextStyle.justifyContent = nextStyle.justifyContent ?? 'stretch';
    return nextStyle;
  }

  if (node.type === 'row' || node.type === 'column' || node.type === 'stack' || node.type === 'card' || node.type === 'section') {
    const direction =
      node.type === 'row'
        ? 'row'
        : node.type === 'column' || node.type === 'card' || node.type === 'section'
          ? 'column'
          : getNodePropAsString(node, 'direction') || 'column';
    nextStyle.display = 'flex';
    nextStyle.flexDirection = nextStyle.flexDirection ?? (direction as CSSProperties['flexDirection']);
    nextStyle.flexWrap = nextStyle.flexWrap ?? (direction === 'row' ? 'wrap' : 'nowrap');
    nextStyle.gap = nextStyle.gap ?? '1rem';
    nextStyle.alignItems = nextStyle.alignItems ?? 'stretch';
    nextStyle.justifyContent = nextStyle.justifyContent ?? 'flex-start';
  }

  return nextStyle;
};


const renderChildren = (
  node: Node,
  interactive: boolean,
  disableVisualStyles: boolean,
  publicSlug?: string | null
) =>
  node.children?.map((child) => (
    <NodeRenderer
      key={child.id}
      node={child}
      parentId={node.id}
      interactive={interactive}
      disableVisualStyles={disableVisualStyles}
      publicSlug={publicSlug}
    />
  )) ?? null;

const renderTextNode = (
  node: Node,
  interactive: boolean,
  tokenMap: Record<string, string>,
  disableVisualStyles: boolean,
  editableProps?: HTMLAttributes<HTMLParagraphElement>
) => {
  const href = getNodePropAsString(node, 'href').trim();
  const target = getNodePropAsString(node, 'target').trim();
  const rel = getNodePropAsString(node, 'rel').trim();
  const textElement = (
    <p
      style={resolveNodeStyles(node, tokenMap, disableVisualStyles, interactive)}
      className="max-w-full break-words text-sm text-inherit [overflow-wrap:anywhere]"
      contentEditable={interactive}
      suppressContentEditableWarning
      {...editableProps}
    >
      {getNodePropAsString(node, 'content') || node.name}
    </p>
  );

  if (!href) {
    return textElement;
  }

  return (
    <a
      href={href}
      target={target || undefined}
      rel={rel || undefined}
      onClick={(event) => interactive && event.preventDefault()}
      className="inline-block max-w-full align-top"
    >
      {textElement}
    </a>
  );
};

const renderButtonNode = (
  node: Node,
  interactive: boolean,
  tokenMap: Record<string, string>,
  disableVisualStyles: boolean,
  editableProps?: HTMLAttributes<HTMLButtonElement>
) => {
  const href = getNodePropAsString(node, 'href').trim();
  const target = getNodePropAsString(node, 'target').trim();
  const rel = getNodePropAsString(node, 'rel').trim();
  const buttonClassName =
    'max-w-full break-words rounded-full bg-neon-gradient px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-inherit shadow-lg neon-glow-soft transition hover:brightness-110';

  if (href) {
    return (
      <a
        href={href}
        target={target || undefined}
        rel={rel || undefined}
        style={resolveNodeStyles(node, tokenMap, disableVisualStyles, interactive)}
        className={`inline-flex ${buttonClassName}`}
        onClick={(event) => interactive && event.preventDefault()}
      >
        <span
          contentEditable={interactive}
          suppressContentEditableWarning
          {...editableProps}
        >
          {getNodePropAsString(node, 'label') || node.name}
        </span>
      </a>
    );
  }

  return (
    <button
      type="button"
      style={resolveNodeStyles(node, tokenMap, disableVisualStyles, interactive)}
      className={buttonClassName}
      contentEditable={interactive}
      suppressContentEditableWarning
      {...editableProps}
    >
      {getNodePropAsString(node, 'label') || node.name}
    </button>
  );
};

const renderImageNode = (
  node: Node,
  interactive: boolean,
  tokenMap: Record<string, string>,
  disableVisualStyles: boolean
) => {
  const src = getNodePropAsString(node, 'src');
  const alt = getNodePropAsString(node, 'alt') || node.name;
  const href = getNodePropAsString(node, 'href').trim();
  const target = getNodePropAsString(node, 'target').trim();
  const rel = getNodePropAsString(node, 'rel').trim();
  const style = resolveNodeStyles(node, tokenMap, disableVisualStyles, interactive);
  const showOutline = readBooleanNodeProp(node, 'showOutline', true);

  if (!src) {
    return (
      <div
        style={style}
        className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 text-xs uppercase tracking-[0.2em] text-slate-400"
      >
        Missing image source
      </div>
    );
  }

  const imageElement = (
    <img
      src={src}
      alt={alt}
      style={style}
      className={`h-auto w-full max-w-full rounded-2xl object-cover ${
        showOutline ? 'border border-slate-800 shadow-lg shadow-slate-900/40' : ''
      }`}
    />
  );

  if (!href) {
    return imageElement;
  }

  return (
    <a
      href={href}
      target={target || undefined}
      rel={rel || undefined}
      className="inline-block max-w-full align-top"
      onClick={(event) => interactive && event.preventDefault()}
    >
      {imageElement}
    </a>
  );
};

const renderLayoutNode = (
  node: Node,
  interactive: boolean,
  tokenMap: Record<string, string>,
  disableVisualStyles: boolean,
  as: 'div' | 'section' = 'div',
  publicSlug?: string | null
) => {
  const style = resolveNodeStyles(node, tokenMap, disableVisualStyles, interactive);
  if (!interactive) {
    if (typeof style.width === 'string' || typeof style.width === 'number') {
      style.width = `min(100%, ${style.width})`;
    }
  }

  const widthValue = style.width;
  const hasExplicitWidth =
    typeof widthValue === 'number' ||
    (typeof widthValue === 'string' &&
      widthValue.trim().length > 0 &&
      widthValue.trim().toLowerCase() !== 'auto' &&
      widthValue.trim().toLowerCase() !== 'fit-content' &&
      widthValue.trim().toLowerCase() !== 'max-content' &&
      widthValue.trim().toLowerCase() !== 'min-content');
  const hasBackground = Boolean(style.background || style.backgroundColor);
  const className = interactive
    ? `rounded-2xl border-neon-soft p-4${hasBackground ? '' : ' bg-black/40'}`
    : hasExplicitWidth
      ? 'max-w-full'
      : 'w-full max-w-full';

  if (as === 'section') {
    return (
      <section style={style} className={className}>
        {renderChildren(node, interactive, disableVisualStyles, publicSlug)}
      </section>
    );
  }

  return (
    <div style={style} className={className}>
      {renderChildren(node, interactive, disableVisualStyles, publicSlug)}
    </div>
  );
};

const normalizeFieldKey = (value: string, fallback: string) => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return normalized || fallback;
};

const readItems = (value: unknown): Array<Record<string, unknown>> =>
  Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    : [];

const trackPublicEvent = async (
  publicSlug: string | null | undefined,
  payload: Record<string, unknown>
) => {
  if (!publicSlug?.trim()) {
    return;
  }
  try {
    await fetch(`/api/public/${encodeURIComponent(publicSlug)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch {
    // Avoid blocking interactions on tracking failures.
  }
};

type InteractionNodeViewProps = {
  node: Node;
  interactive: boolean;
  tokenMap: Record<string, string>;
  disableVisualStyles: boolean;
  publicSlug?: string | null;
};

function FormNodeView({
  node,
  interactive,
  tokenMap,
  disableVisualStyles,
  publicSlug
}: InteractionNodeViewProps) {
  const fields = readItems(node.props?.fields);
  const title = getNodePropAsString(node, 'title') || node.name;
  const description = getNodePropAsString(node, 'description');
  const submitLabel = getNodePropAsString(node, 'submitLabel') || 'Submit';
  const successMessage = getNodePropAsString(node, 'successMessage') || 'Thanks for submitting.';
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (interactive) {
      event.preventDefault();
      setMessage('Form submits only on live pages.');
      return;
    }
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const values = fields.reduce<Record<string, string>>((acc, field, index) => {
      const key = normalizeFieldKey(String(field.key ?? ''), `field_${index + 1}`);
      const value = formData.get(key);
      acc[key] = typeof value === 'string' ? value : '';
      return acc;
    }, {});
    setIsSubmitting(true);
    setMessage(null);
    await trackPublicEvent(publicSlug, {
      eventType: 'form_submit',
      nodeId: node.id,
      nodeType: node.type,
      nodeName: node.name,
      values
    });
    setIsSubmitting(false);
    setMessage(successMessage);
    event.currentTarget.reset();
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={resolveNodeStyles(node, tokenMap, disableVisualStyles, interactive)}
      className="w-full rounded-2xl border border-slate-800/80 bg-black/50 p-4"
    >
      <h3 className="text-base font-semibold text-slate-100">{title}</h3>
      {description ? <p className="mt-1 text-sm text-slate-300">{description}</p> : null}
      <div className="mt-4 space-y-3">
        {fields.map((field, index) => {
          const fieldLabel = String(field.label ?? `Field ${index + 1}`);
          const fieldType = String(field.type ?? 'text').toLowerCase();
          const key = normalizeFieldKey(String(field.key ?? ''), `field_${index + 1}`);
          const required = Boolean(field.required);
          const placeholder = String(field.placeholder ?? '');
          return (
            <label key={`${node.id}-${key}-${index}`} className="block text-xs uppercase tracking-[0.18em] text-slate-400">
              {fieldLabel}
              {fieldType === 'textarea' ? (
                <textarea
                  name={key}
                  required={required}
                  placeholder={placeholder}
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-slate-700/80 bg-black/70 px-3 py-2 text-sm normal-case text-slate-100 focus:border-cyan-200 focus:outline-none"
                />
              ) : (
                <input
                  type={fieldType === 'email' || fieldType === 'tel' ? fieldType : 'text'}
                  name={key}
                  required={required}
                  placeholder={placeholder}
                  className="mt-2 w-full rounded-lg border border-slate-700/80 bg-black/70 px-3 py-2 text-sm normal-case text-slate-100 focus:border-cyan-200 focus:outline-none"
                />
              )}
            </label>
          );
        })}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-4 rounded-full bg-neon-gradient px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 disabled:opacity-60"
      >
        {isSubmitting ? 'Sending...' : submitLabel}
      </button>
      {message ? <p className="mt-3 text-xs text-cyan-200">{message}</p> : null}
    </form>
  );
}

function PollNodeView({
  node,
  interactive,
  tokenMap,
  disableVisualStyles,
  publicSlug
}: InteractionNodeViewProps) {
  const question = getNodePropAsString(node, 'question') || node.name;
  const submitLabel = getNodePropAsString(node, 'submitLabel') || 'Vote';
  const options = readItems(node.props?.options)
    .map((option, index) => ({
      id: `${node.id}-${index}`,
      label: String(option.label ?? `Option ${index + 1}`)
    }))
    .filter((entry) => entry.label.trim().length > 0);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const localVoteKey = `poll-voted:${publicSlug ?? 'preview'}:${node.id}`;
  const hasVoted = !interactive && typeof window !== 'undefined' && window.localStorage.getItem(localVoteKey) === '1';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (interactive) {
      setMessage('Poll voting is available on live pages.');
      return;
    }
    if (!selectedOption) {
      setMessage('Choose an option first.');
      return;
    }
    if (hasVoted) {
      setMessage('This browser already voted on this poll.');
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    await trackPublicEvent(publicSlug, {
      eventType: 'poll_vote',
      nodeId: node.id,
      nodeType: node.type,
      nodeName: node.name,
      option: selectedOption
    });
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(localVoteKey, '1');
    }
    setIsSubmitting(false);
    setMessage('Vote counted. Thank you!');
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={resolveNodeStyles(node, tokenMap, disableVisualStyles, interactive)}
      className="w-full rounded-2xl border border-slate-800/80 bg-black/50 p-4"
    >
      <p className="text-sm font-semibold text-slate-100">{question}</p>
      <div className="mt-3 space-y-2">
        {options.map((option) => (
          <label key={option.id} className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="radio"
              name={`poll-${node.id}`}
              value={option.label}
              checked={selectedOption === option.label}
              onChange={(event) => setSelectedOption(event.target.value)}
              disabled={hasVoted}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={isSubmitting || hasVoted}
        className="mt-4 rounded-full bg-neon-gradient px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 disabled:opacity-60"
      >
        {isSubmitting ? 'Saving...' : hasVoted ? 'Already voted' : submitLabel}
      </button>
      {message ? <p className="mt-3 text-xs text-cyan-200">{message}</p> : null}
    </form>
  );
}

const nodeRenderers: Partial<
  Record<
    Node['type'],
    (
      node: Node,
      interactive: boolean,
      tokenMap: Record<string, string>,
      disableVisualStyles: boolean,
      editableProps?: HTMLAttributes<HTMLElement>,
      publicSlug?: string | null
    ) => JSX.Element
  >
> = {
  text: renderTextNode,
  button: renderButtonNode,
  image: renderImageNode,
  container: (node, interactive, tokenMap, disableVisualStyles, _editableProps, publicSlug) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles, 'div', publicSlug),
  section: (node, interactive, tokenMap, disableVisualStyles, _editableProps, publicSlug) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles, 'section', publicSlug),
  stack: (node, interactive, tokenMap, disableVisualStyles, _editableProps, publicSlug) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles, 'div', publicSlug),
  row: (node, interactive, tokenMap, disableVisualStyles, _editableProps, publicSlug) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles, 'div', publicSlug),
  column: (node, interactive, tokenMap, disableVisualStyles, _editableProps, publicSlug) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles, 'div', publicSlug),
  grid: (node, interactive, tokenMap, disableVisualStyles, _editableProps, publicSlug) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles, 'div', publicSlug),
  card: (node, interactive, tokenMap, disableVisualStyles, _editableProps, publicSlug) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles, 'div', publicSlug),
  form: (node, interactive, tokenMap, disableVisualStyles, _editableProps, publicSlug) =>
    <FormNodeView
      node={node}
      interactive={interactive}
      tokenMap={tokenMap}
      disableVisualStyles={disableVisualStyles}
      publicSlug={publicSlug}
    />,
  poll: (node, interactive, tokenMap, disableVisualStyles, _editableProps, publicSlug) =>
    <PollNodeView
      node={node}
      interactive={interactive}
      tokenMap={tokenMap}
      disableVisualStyles={disableVisualStyles}
      publicSlug={publicSlug}
    />
};

const parseLength = (value?: string) => {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toPx = (value: number) => `${Math.round(value)}px`;

const getResponsiveColumnMinWidth = (columnCount: number) => {
  if (columnCount >= 4) {
    return 180;
  }
  if (columnCount === 3) {
    return 220;
  }
  if (columnCount === 2) {
    return 260;
  }
  return 320;
};
const blockTemplateMimeType = 'application/x-block-template';
const primitiveNodeMimeType = 'application/x-node-primitive';

export default function NodeRenderer({
  node,
  parentId = null,
  interactive = true,
  disableVisualStyles = false,
  publicSlug = null
}: NodeRendererProps) {
  const componentFamilies = useEditorStore((state) => state.componentFamilies);
  const resolvedNode = useMemo(() => {
    if (!isComponentInstanceNode(node)) {
      return node;
    }
    return resolveComponentInstanceNode(node, componentFamilies) ?? node;
  }, [componentFamilies, node]);
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useEditorStore((state) => state.setSelectedNodeId);
  const updateNodeProps = useEditorStore((state) => state.updateNodeProps);
  const addNodeToContainer = useEditorStore((state) => state.addNodeToContainer);
  const gridSize = useEditorStore((state) => state.gridSize);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const interactableRef = useRef<ReturnType<typeof interact> | null>(null);
  const { tokens } = useTheme();
  const x = parseLength(getNodePropAsString(resolvedNode, 'x'));
  const y = parseLength(getNodePropAsString(resolvedNode, 'y'));
  const width = getNodePropAsString(resolvedNode, 'width');
  const height = getNodePropAsString(resolvedNode, 'height');
  const positionRef = useRef({ x, y });
  const renderer = nodeRenderers[resolvedNode.type];
  const tokenMap = useMemo(() => buildTokenVarMap(tokens), [tokens]);
  const isComponentNodeInstance = isComponentInstanceNode(node);
  const isSelected = selectedNodeId === node.id;
  const [isEditing, setIsEditing] = useState(false);
  const [dropIndicatorIndex, setDropIndicatorIndex] = useState<number | null>(null);
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!interactive) {
      return;
    }
    event.stopPropagation();
    setSelectedNodeId(node.id);
  };
  const isLayoutNode = layoutNodeTypes.has(resolvedNode.type);
  const allowManualSizing = interactive && !isComponentNodeInstance && !isLayoutNode;

  const resolveDropIndex = (event: DragEvent<HTMLDivElement>) => {
    const childrenCount = resolvedNode.children?.length ?? 0;
    if (childrenCount === 0) {
      return 0;
    }
    const target = event.target as HTMLElement;
    const childElement = target.closest('[data-node-wrapper="true"]') as HTMLElement | null;
    if (childElement && childElement.dataset.nodeParentId === resolvedNode.id) {
      const childId = childElement.dataset.nodeId;
      const childIndex = (resolvedNode.children ?? []).findIndex((child) => child.id === childId);
      if (childIndex >= 0) {
        const rect = childElement.getBoundingClientRect();
        const isRowAxis = resolvedNode.type === 'row';
        const beforeMidpoint = isRowAxis
          ? event.clientX < rect.left + rect.width / 2
          : event.clientY < rect.top + rect.height / 2;
        return beforeMidpoint ? childIndex : childIndex + 1;
      }
    }
    return childrenCount;
  };

  const resolveDraggedTemplate = (event: DragEvent<HTMLDivElement>) => {
    const templateName =
      event.dataTransfer.getData(blockTemplateMimeType) ||
      event.dataTransfer.getData('text/plain');
    if (!templateName) {
      return null;
    }
    return blockTemplates.find((item) => item.key === templateName)?.template ?? null;
  };
  const resolveDraggedPrimitive = (event: DragEvent<HTMLDivElement>) => {
    const type = event.dataTransfer.getData(primitiveNodeMimeType) as Node['type'];
    if (!type) {
      return null;
    }
    const schema = getNodeSchema(type);
    if (!schema) {
      return null;
    }
    return {
      type,
      name: schema.defaultName,
      props: schema.defaultProps
    };
  };

  const handleContainerDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!isLayoutNode) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setDropIndicatorIndex(resolveDropIndex(event));
  };
  const handleContainerDrop = (event: DragEvent<HTMLDivElement>) => {
    if (!isLayoutNode) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const template = resolveDraggedTemplate(event);
    const primitiveTemplate = resolveDraggedPrimitive(event);
    const dropTemplate = template ?? primitiveTemplate;
    if (!dropTemplate) {
      setDropIndicatorIndex(null);
      return;
    }

    addNodeToContainer(node.id, buildNodeFromTemplate(dropTemplate), dropIndicatorIndex ?? undefined);
    setDropIndicatorIndex(null);
  };
  const handleContainerDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (!isLayoutNode) {
      return;
    }
    if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) {
      setDropIndicatorIndex(null);
    }
  };
  const positionStyle = useMemo(() => {
    const style: CSSProperties = {
      transform: `translate(${x}px, ${y}px)`,
      touchAction: interactive ? 'none' : undefined
    };

    if (width && allowManualSizing) {
      style.width = width;
    }

    if (height && allowManualSizing) {
      style.height = height;
    }
    if (!interactive) {
      style.maxWidth = '100%';
    }

    if (isComponentNodeInstance) {
      style.maxWidth = '100%';
      style.transform = undefined;
    }

    return style;
  }, [allowManualSizing, height, interactive, isComponentNodeInstance, width, x, y]);

  useEffect(() => {
    positionRef.current = { x, y };
  }, [x, y]);

  useEffect(() => {
    if (!interactive || isComponentNodeInstance) {
      return;
    }
    const element = wrapperRef.current;
    if (!element) {
      return;
    }
    const canvasBoundary = document.querySelector('[data-canvas-boundary]') ?? 'parent';

    const snapGridSize = Math.max(4, gridSize);
    const snapGrid = interact.snappers.grid({ x: snapGridSize, y: snapGridSize });
    const snapModifiers = [
      interact.modifiers.snap({
        targets: [snapGrid]
      })
    ];
    const dragModifiers = [
      ...snapModifiers,
      interact.modifiers.restrictRect({
        restriction: canvasBoundary,
        endOnly: true
      })
    ];
    const resizeModifiers = [
      ...snapModifiers,
      interact.modifiers.restrictEdges({
        outer: canvasBoundary,
        endOnly: true
      })
    ];

    const interactable = interact(element)
      .draggable({
        allowFrom: '.node-drag-handle',
        modifiers: dragModifiers,
        listeners: {
          move(event) {
            const { x: currentX, y: currentY } = positionRef.current;
            const nextX = currentX + event.dx;
            const nextY = currentY + event.dy;
            positionRef.current = { x: nextX, y: nextY };
            updateNodeProps(node.id, {
              x: toPx(nextX),
              y: toPx(nextY)
            }, { history: 'debounced' });
          },
          end() {
            const { x: finalX, y: finalY } = positionRef.current;
            updateNodeProps(node.id, {
              x: toPx(finalX),
              y: toPx(finalY)
            });
          }
        }
      })
      .resizable({
        enabled: !isLayoutNode,
        edges: {
          left: '.resize-handle-left',
          right: '.resize-handle-right',
          bottom: '.resize-handle-bottom',
          top: '.resize-handle-top'
        },
        modifiers: resizeModifiers,
        listeners: {
          move(event) {
            const { x: currentX, y: currentY } = positionRef.current;
            const nextX = currentX + event.deltaRect.left;
            const nextY = currentY + event.deltaRect.top;
            positionRef.current = { x: nextX, y: nextY };
            updateNodeProps(node.id, {
              x: toPx(nextX),
              y: toPx(nextY),
              width: toPx(event.rect.width),
              height: toPx(event.rect.height)
            }, { history: 'debounced' });
          },
          end(event) {
            const { x: finalX, y: finalY } = positionRef.current;
            updateNodeProps(node.id, {
              x: toPx(finalX),
              y: toPx(finalY),
              width: toPx(event.rect.width),
              height: toPx(event.rect.height)
            });
          }
        }
      });
    interactableRef.current = interactable;

    return () => {
      interactable.unset();
      interactableRef.current = null;
    };
  }, [gridSize, interactive, isComponentNodeInstance, isLayoutNode, node.id, updateNodeProps]);

  useEffect(() => {
    if (!interactive || isComponentNodeInstance) {
      return;
    }
    if (!interactableRef.current) {
      return;
    }
    interactableRef.current.draggable({ enabled: !isEditing });
    interactableRef.current.resizable({ enabled: !isEditing && !isLayoutNode });
  }, [interactive, isEditing, isLayoutNode]);

  const handleEditableFocus = (event: FocusEvent<HTMLElement>) => {
    if (!interactive || isComponentNodeInstance) {
      return;
    }
    event.stopPropagation();
    setSelectedNodeId(node.id);
    setIsEditing(true);
  };

  const handleEditableBlur = (key: 'content' | 'label') => (event: FocusEvent<HTMLElement>) => {
    if (!interactive || isComponentNodeInstance) {
      return;
    }
    event.stopPropagation();
    setIsEditing(false);
    const nextValue = event.currentTarget.textContent ?? '';
    updateNodeProps(node.id, { [key]: nextValue });
  };

  const handleEditableInput = (key: 'content' | 'label') => (event: FormEvent<HTMLElement>) => {
    if (!interactive || isComponentNodeInstance) {
      return;
    }
    event.stopPropagation();
    const nextValue = event.currentTarget.textContent ?? '';
    updateNodeProps(node.id, { [key]: nextValue }, { history: 'debounced' });
  };

  const stopEditablePropagation = (event: MouseEvent<HTMLElement>) => {
    if (!interactive || isComponentNodeInstance) {
      return;
    }
    event.stopPropagation();
  };

  const editableProps =
    interactive && (node.type === 'text' || node.type === 'button')
      ? {
          onFocus: handleEditableFocus,
          onBlur: handleEditableBlur(node.type === 'text' ? 'content' : 'label'),
          onInput: handleEditableInput(node.type === 'text' ? 'content' : 'label'),
          onMouseDown: stopEditablePropagation,
          onClick: stopEditablePropagation
        }
      : undefined;

  const resizeHandles =
    interactive && isSelected && !isEditing && !isComponentNodeInstance && !isLayoutNode ? (
      <div className="pointer-events-none absolute inset-0">
        <div className="resize-handle resize-handle-top resize-handle-left pointer-events-auto absolute left-0 top-0 h-2 w-2 -translate-x-1 -translate-y-1 border-2 border-slate-100 bg-slate-900/90" />
        <div className="resize-handle resize-handle-top resize-handle-right pointer-events-auto absolute right-0 top-0 h-2 w-2 translate-x-1 -translate-y-1 border-2 border-slate-100 bg-slate-900/90" />
        <div className="resize-handle resize-handle-bottom resize-handle-left pointer-events-auto absolute bottom-0 left-0 h-2 w-2 -translate-x-1 translate-y-1 border-2 border-slate-100 bg-slate-900/90" />
        <div className="resize-handle resize-handle-bottom resize-handle-right pointer-events-auto absolute bottom-0 right-0 h-2 w-2 translate-x-1 translate-y-1 border-2 border-slate-100 bg-slate-900/90" />
        <div className="resize-handle resize-handle-top pointer-events-auto absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1 border-2 border-slate-100 bg-slate-900/90" />
        <div className="resize-handle resize-handle-bottom pointer-events-auto absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1 border-2 border-slate-100 bg-slate-900/90" />
        <div className="resize-handle resize-handle-left pointer-events-auto absolute left-0 top-1/2 h-2 w-2 -translate-x-1 -translate-y-1/2 border-2 border-slate-100 bg-slate-900/90" />
        <div className="resize-handle resize-handle-right pointer-events-auto absolute right-0 top-1/2 h-2 w-2 translate-x-1 -translate-y-1/2 border-2 border-slate-100 bg-slate-900/90" />
      </div>
    ) : null;

  const dragHandle =
    interactive && isSelected && !isComponentNodeInstance ? (
      <button
        type="button"
        className={`node-drag-handle absolute left-2 top-2 z-30 h-6 w-6 rounded-full border border-slate-700/80 bg-black/70 text-[0.55rem] uppercase tracking-[0.12em] text-slate-300 transition hover:border-cyan-300/70 hover:text-cyan-100 ${
          isEditing ? 'pointer-events-none opacity-0' : 'opacity-90'
        }`}
        onMouseDown={(event) => {
          event.stopPropagation();
          setSelectedNodeId(node.id);
        }}
        onClick={(event) => event.stopPropagation()}
        aria-label={`Move ${node.name}`}
        title="Drag to move"
      >
        ↕
      </button>
    ) : null;


  const insertionIndicator =
    interactive && isLayoutNode && dropIndicatorIndex !== null ? (
      <div
        className="pointer-events-none absolute left-2 right-2 z-20 h-0 border-t-2 border-cyan-300"
        style={{ top: `${Math.max(8, dropIndicatorIndex * 40 + 12)}px` }}
      />
    ) : null;

  if (renderer) {
    return (
      <div
        onClick={handleClick}
        onDragOver={handleContainerDragOver}
        onDrop={handleContainerDrop}
        onDragLeave={handleContainerDragLeave}
        ref={wrapperRef}
        style={positionStyle}
        data-node-wrapper="true"
        data-node-id={node.id}
        data-node-parent-id={parentId ?? undefined}
        className={
          interactive
            ? `relative min-w-0 cursor-pointer rounded-2xl transition-shadow ${
                isSelected ? 'neon-ring' : 'neon-ring-hover'
              }`
            : 'relative min-w-0 max-w-full rounded-2xl'
        }
      >
        {renderer(
          resolvedNode,
          interactive && !isComponentNodeInstance,
          tokenMap,
          disableVisualStyles,
          editableProps,
          publicSlug
        )}
        {dragHandle}
        {insertionIndicator}
        {resizeHandles}
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      ref={wrapperRef}
      data-node-wrapper="true"
      data-node-id={node.id}
      data-node-parent-id={parentId ?? undefined}
      className={
        interactive
          ? `relative min-w-0 cursor-pointer rounded-2xl border border-slate-900/80 bg-black/40 p-4 transition-shadow ${
              isSelected ? 'neon-ring' : 'neon-ring-hover'
            }`
          : 'relative min-w-0 rounded-2xl border border-slate-900/80 bg-black/40 p-4'
      }
      style={{
        ...resolveNodeStyles(
          resolvedNode,
          tokenMap,
          disableVisualStyles,
          interactive && !isComponentNodeInstance
        ),
        ...positionStyle
      }}
    >
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{resolvedNode.type}</div>
      <p className="mt-2 text-sm text-slate-200">{resolvedNode.name}</p>
      {dragHandle}
      {renderChildren(
        resolvedNode,
        interactive && !isComponentNodeInstance,
        disableVisualStyles,
        publicSlug
      )}
      {resizeHandles}
    </div>
  );
}
