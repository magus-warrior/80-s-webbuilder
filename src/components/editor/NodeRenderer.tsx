import type { CSSProperties, MouseEvent } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import interact from 'interactjs';

import type { Node } from '../../models';
import { useEditorStore } from '../../store/editorStore';

type NodeRendererProps = {
  node: Node;
  interactive?: boolean;
};

const stylePropHandlers: Record<
  string,
  (value: string, style: CSSProperties) => void
> = {
  color: (value, style) => {
    style.color = value;
  },
  background: (value, style) => {
    style.background = value;
  },
  backgroundColor: (value, style) => {
    style.backgroundColor = value;
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
  gridTemplateColumns: (value, style) => {
    style.gridTemplateColumns = value;
  }
};

const resolveNodeStyles = (node: Node): CSSProperties => {
  const style: CSSProperties = {};
  const props = node.props ?? {};

  Object.entries(props).forEach(([key, value]) => {
    const handler = stylePropHandlers[key];
    if (handler) {
      handler(value, style);
    }
  });

  if (node.type === 'container' && props.columns) {
    const columnCount = Number.parseInt(props.columns, 10);
    if (!Number.isNaN(columnCount) && columnCount > 0) {
      style.display = style.display ?? 'grid';
      style.gridTemplateColumns =
        style.gridTemplateColumns ?? `repeat(${columnCount}, minmax(0, 1fr))`;
      style.gap = style.gap ?? '1rem';
    }
  }

  return style;
};

const renderChildren = (node: Node, interactive: boolean) =>
  node.children?.map((child) => (
    <NodeRenderer key={child.id} node={child} interactive={interactive} />
  )) ?? null;

const renderTextNode = (node: Node, _interactive: boolean) => (
  <p style={resolveNodeStyles(node)} className="text-sm text-slate-100">
    {node.props?.content ?? node.name}
  </p>
);

const renderButtonNode = (node: Node, _interactive: boolean) => (
  <button
    type="button"
    style={resolveNodeStyles(node)}
    className="rounded-full bg-neon-gradient px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-950 shadow-lg neon-glow-soft transition hover:brightness-110"
  >
    {node.props?.label ?? node.name}
  </button>
);

const renderImageNode = (node: Node, _interactive: boolean) => {
  const src = node.props?.src;
  const alt = node.props?.alt ?? node.name;
  const style = resolveNodeStyles(node);

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

  return (
    <img
      src={src}
      alt={alt}
      style={style}
      className="h-auto w-full rounded-2xl border border-slate-800 object-cover shadow-lg shadow-slate-900/40"
    />
  );
};

const renderContainerNode = (node: Node, interactive: boolean) => (
  <div style={resolveNodeStyles(node)} className="rounded-2xl border-neon-soft bg-black/40 p-4">
    {renderChildren(node, interactive)}
  </div>
);

const nodeRenderers: Partial<
  Record<Node['type'], (node: Node, interactive: boolean) => JSX.Element>
> = {
  text: renderTextNode,
  button: renderButtonNode,
  image: renderImageNode,
  container: renderContainerNode
};

const parseLength = (value?: string) => {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toPx = (value: number) => `${Math.round(value)}px`;

export default function NodeRenderer({ node, interactive = true }: NodeRendererProps) {
  const selectedNodeId = useEditorStore((state) => state.selectedNodeId);
  const setSelectedNodeId = useEditorStore((state) => state.setSelectedNodeId);
  const updateNodeProps = useEditorStore((state) => state.updateNodeProps);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const x = parseLength(node.props?.x);
  const y = parseLength(node.props?.y);
  const width = node.props?.width;
  const height = node.props?.height;
  const positionRef = useRef({ x, y });
  const renderer = nodeRenderers[node.type];
  const isSelected = selectedNodeId === node.id;
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!interactive) {
      return;
    }
    event.stopPropagation();
    setSelectedNodeId(node.id);
  };
  const positionStyle = useMemo(() => {
    const style: CSSProperties = {
      transform: `translate(${x}px, ${y}px)`,
      touchAction: interactive ? 'none' : undefined
    };

    if (width) {
      style.width = width;
    }

    if (height) {
      style.height = height;
    }

    return style;
  }, [x, y, width, height]);

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

    const interactable = interact(element)
      .draggable({
        listeners: {
          move(event) {
            const { x: currentX, y: currentY } = positionRef.current;
            const nextX = currentX + event.dx;
            const nextY = currentY + event.dy;
            positionRef.current = { x: nextX, y: nextY };
            updateNodeProps(node.id, {
              x: toPx(nextX),
              y: toPx(nextY)
            });
          }
        }
      })
      .resizable({
        edges: { left: true, right: true, bottom: true, top: true },
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
            });
          }
        }
      });

    return () => {
      interactable.unset();
    };
  }, [interactive, node.id, updateNodeProps]);

  if (renderer) {
    return (
      <div
        onClick={handleClick}
        ref={wrapperRef}
        style={positionStyle}
        className={
          interactive
            ? `cursor-pointer rounded-2xl transition-shadow ${
                isSelected ? 'neon-ring' : 'neon-ring-hover'
              }`
            : 'rounded-2xl'
        }
      >
        {renderer(node, interactive)}
      </div>
    );
  }

  return (
    <div
      onClick={handleClick}
      ref={wrapperRef}
      className={
        interactive
          ? `cursor-pointer rounded-2xl border border-slate-900/80 bg-black/40 p-4 transition-shadow ${
              isSelected ? 'neon-ring' : 'neon-ring-hover'
            }`
          : 'rounded-2xl border border-slate-900/80 bg-black/40 p-4'
      }
      style={{ ...resolveNodeStyles(node), ...positionStyle }}
    >
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{node.type}</div>
      <p className="mt-2 text-sm text-slate-200">{node.name}</p>
      {renderChildren(node, interactive)}
    </div>
  );
}
