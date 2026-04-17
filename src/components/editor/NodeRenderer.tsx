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
import { getNodePropAsString } from './nodeSchemas';
import { blockTemplates, buildNodeFromTemplate } from './templates';
import { useTheme } from './ThemeProvider';

type NodeRendererProps = {
  node: Node;
  parentId?: string | null;
  interactive?: boolean;
  disableVisualStyles?: boolean;
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
  interactive = true
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

  return resolveLayoutStyle(node, style, interactive);
};


const layoutNodeTypes = new Set(['container', 'stack', 'row', 'column', 'grid', 'card', 'section']);

const resolveLayoutStyle = (
  node: Node,
  style: CSSProperties,
  interactive: boolean
): CSSProperties => {
  const nextStyle: CSSProperties = { ...style };
  const props = node.props ?? {};
  const columns = Number.parseInt(String(props.columns ?? ''), 10);
  const minColumnWidth = getNodePropAsString(node, 'minColumnWidth') || `${getResponsiveColumnMinWidth(columns || 1)}px`;

  if (node.type === 'container' || node.type === 'grid') {
    const safeColumns = Number.isNaN(columns) || columns < 1 ? 1 : columns;
    nextStyle.display = 'grid';
    nextStyle.gap = nextStyle.gap ?? '1rem';
    nextStyle.gridTemplateColumns = interactive
      ? `repeat(${safeColumns}, minmax(0, 1fr))`
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
  disableVisualStyles: boolean
) =>
  node.children?.map((child) => (
    <NodeRenderer
      key={child.id}
      node={child}
      parentId={node.id}
      interactive={interactive}
      disableVisualStyles={disableVisualStyles}
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
      className="text-sm text-inherit"
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
      className="h-auto w-full max-w-full rounded-2xl border border-slate-800 object-cover shadow-lg shadow-slate-900/40"
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
  as: 'div' | 'section' = 'div'
) => {
  const style = resolveNodeStyles(node, tokenMap, disableVisualStyles, interactive);
  if (!interactive) {
    style.height = undefined;
    if (typeof style.width === 'string' || typeof style.width === 'number') {
      style.width = `min(100%, ${style.width})`;
    }
  }

  const hasExplicitWidth = Object.entries(node.props ?? {}).some(([key, value]) => {
    if (typeof value !== 'string' && typeof value !== 'number') {
      return false;
    }
    return key.replace(/[-_]+([a-z])/gi, (_, letter: string) => letter.toUpperCase()) === 'width';
  });
  const hasBackground = Boolean(style.background || style.backgroundColor);
  const className = interactive
    ? `rounded-2xl border-neon-soft p-4${hasBackground ? '' : ' bg-black/40'}`
    : hasExplicitWidth
      ? 'max-w-full'
      : 'w-full max-w-full';

  if (as === 'section') {
    return (
      <section style={style} className={className}>
        {renderChildren(node, interactive, disableVisualStyles)}
      </section>
    );
  }

  return (
    <div style={style} className={className}>
      {renderChildren(node, interactive, disableVisualStyles)}
    </div>
  );
};

const nodeRenderers: Partial<
  Record<
    Node['type'],
    (
      node: Node,
      interactive: boolean,
      tokenMap: Record<string, string>,
      disableVisualStyles: boolean,
      editableProps?: HTMLAttributes<HTMLElement>
    ) => JSX.Element
  >
> = {
  text: renderTextNode,
  button: renderButtonNode,
  image: renderImageNode,
  container: (node, interactive, tokenMap, disableVisualStyles) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles),
  section: (node, interactive, tokenMap, disableVisualStyles) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles, 'section'),
  stack: (node, interactive, tokenMap, disableVisualStyles) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles),
  row: (node, interactive, tokenMap, disableVisualStyles) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles),
  column: (node, interactive, tokenMap, disableVisualStyles) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles),
  grid: (node, interactive, tokenMap, disableVisualStyles) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles),
  card: (node, interactive, tokenMap, disableVisualStyles) =>
    renderLayoutNode(node, interactive, tokenMap, disableVisualStyles)
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

export default function NodeRenderer({
  node,
  parentId = null,
  interactive = true,
  disableVisualStyles = false
}: NodeRendererProps) {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useEditorStore((state) => state.setSelectedNodeId);
  const updateNodeProps = useEditorStore((state) => state.updateNodeProps);
  const addNodeToContainer = useEditorStore((state) => state.addNodeToContainer);
  const gridSize = useEditorStore((state) => state.gridSize);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const interactableRef = useRef<ReturnType<typeof interact> | null>(null);
  const { tokens } = useTheme();
  const x = parseLength(getNodePropAsString(node, 'x'));
  const y = parseLength(getNodePropAsString(node, 'y'));
  const width = getNodePropAsString(node, 'width');
  const height = getNodePropAsString(node, 'height');
  const positionRef = useRef({ x, y });
  const renderer = nodeRenderers[node.type];
  const tokenMap = useMemo(() => buildTokenVarMap(tokens), [tokens]);
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
  const isLayoutNode = layoutNodeTypes.has(node.type);

  const resolveDropIndex = (event: DragEvent<HTMLDivElement>) => {
    const childrenCount = node.children?.length ?? 0;
    if (childrenCount === 0) {
      return 0;
    }
    const target = event.target as HTMLElement;
    const childElement = target.closest('[data-node-wrapper="true"]') as HTMLElement | null;
    if (childElement && childElement.dataset.nodeParentId === node.id) {
      const childId = childElement.dataset.nodeId;
      const childIndex = (node.children ?? []).findIndex((child) => child.id === childId);
      if (childIndex >= 0) {
        const rect = childElement.getBoundingClientRect();
        const isRowAxis = node.type === 'row';
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
      event.dataTransfer.getData('application/x-block-template') ||
      event.dataTransfer.getData('text/plain');
    if (!templateName) {
      return null;
    }
    return blockTemplates.find((item) => item.key === templateName)?.template ?? null;
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
    if (!template) {
      setDropIndicatorIndex(null);
      return;
    }

    const target = event.target as HTMLElement;
    const slotType = target.closest('[data-layout-slot]')?.getAttribute('data-layout-slot');
    if (slotType === 'new-row' || slotType === 'new-column') {
      const wrapperType = slotType === 'new-row' ? 'row' : 'column';
      addNodeToContainer(
        node.id,
        buildNodeFromTemplate({
          type: wrapperType,
          name: wrapperType === 'row' ? 'New Row' : 'New Column',
          props: {},
          children: [template]
        }),
        dropIndicatorIndex ?? undefined
      );
      setDropIndicatorIndex(null);
      return;
    }

    addNodeToContainer(node.id, buildNodeFromTemplate(template), dropIndicatorIndex ?? undefined);
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

    if (width && interactive) {
      style.width = width;
    }

    if (height && interactive) {
      style.height = height;
    }
    if (!interactive) {
      style.maxWidth = '100%';
      style.transform = undefined;
    }

    return style;
  }, [height, interactive, width, x, y]);

  useEffect(() => {
    positionRef.current = { x, y };
  }, [x, y]);

  useEffect(() => {
    if (!interactive) {
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
          }
        }
      })
      .resizable({
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
          }
        }
      });
    interactableRef.current = interactable;

    return () => {
      interactable.unset();
      interactableRef.current = null;
    };
  }, [gridSize, interactive, node.id, updateNodeProps]);

  useEffect(() => {
    if (!interactive) {
      return;
    }
    if (!interactableRef.current) {
      return;
    }
    interactableRef.current.draggable({ enabled: !isEditing });
    interactableRef.current.resizable({ enabled: !isEditing });
  }, [interactive, isEditing]);

  const handleEditableFocus = (event: FocusEvent<HTMLElement>) => {
    if (!interactive) {
      return;
    }
    event.stopPropagation();
    setSelectedNodeId(node.id);
    setIsEditing(true);
  };

  const handleEditableBlur = (key: 'content' | 'label') => (event: FocusEvent<HTMLElement>) => {
    if (!interactive) {
      return;
    }
    event.stopPropagation();
    setIsEditing(false);
    const nextValue = event.currentTarget.textContent ?? '';
    updateNodeProps(node.id, { [key]: nextValue });
  };

  const handleEditableInput = (key: 'content' | 'label') => (event: FormEvent<HTMLElement>) => {
    if (!interactive) {
      return;
    }
    event.stopPropagation();
    const nextValue = event.currentTarget.textContent ?? '';
    updateNodeProps(node.id, { [key]: nextValue }, { history: 'debounced' });
  };

  const stopEditablePropagation = (event: MouseEvent<HTMLElement>) => {
    if (!interactive) {
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
    interactive && isSelected ? (
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


  const insertionIndicator =
    interactive && isLayoutNode && dropIndicatorIndex !== null ? (
      <div
        className="pointer-events-none absolute left-2 right-2 z-20 h-0 border-t-2 border-cyan-300"
        style={{ top: `${Math.max(8, dropIndicatorIndex * 40 + 12)}px` }}
      />
    ) : null;

  const layoutSlotDropZones =
    interactive && isLayoutNode ? (
      <div className="pointer-events-none absolute inset-x-3 bottom-2 z-20 flex gap-2">
        <div
          data-layout-slot="new-row"
          className="pointer-events-auto flex-1 rounded-md border border-dashed border-cyan-400/60 bg-cyan-500/10 px-2 py-1 text-center text-[0.6rem] uppercase tracking-[0.18em] text-cyan-100"
        >
          Drop to wrap in row
        </div>
        <div
          data-layout-slot="new-column"
          className="pointer-events-auto flex-1 rounded-md border border-dashed border-fuchsia-400/60 bg-fuchsia-500/10 px-2 py-1 text-center text-[0.6rem] uppercase tracking-[0.18em] text-fuchsia-100"
        >
          Drop to wrap in column
        </div>
      </div>
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
            ? `relative cursor-pointer rounded-2xl transition-shadow ${
                isSelected ? 'neon-ring' : 'neon-ring-hover'
              }`
            : 'relative max-w-full rounded-2xl'
        }
      >
        {renderer(node, interactive, tokenMap, disableVisualStyles, editableProps)}
        {insertionIndicator}
        {layoutSlotDropZones}
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
          ? `relative cursor-pointer rounded-2xl border border-slate-900/80 bg-black/40 p-4 transition-shadow ${
              isSelected ? 'neon-ring' : 'neon-ring-hover'
            }`
          : 'relative rounded-2xl border border-slate-900/80 bg-black/40 p-4'
      }
      style={{ ...resolveNodeStyles(node, tokenMap, disableVisualStyles, interactive), ...positionStyle }}
    >
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{node.type}</div>
      <p className="mt-2 text-sm text-slate-200">{node.name}</p>
      {renderChildren(node, interactive, disableVisualStyles)}
      {resizeHandles}
    </div>
  );
}
