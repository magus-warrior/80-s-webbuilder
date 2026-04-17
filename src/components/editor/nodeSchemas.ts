import type { Node, NodePropValue, NodeProps } from '../../models';

export type NodeInspectorFieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'image'
  | 'link'
  | 'number'
  | 'range'
  | 'toggle'
  | 'select'
  | 'list'
  | 'repeater';

export interface NodeInspectorFieldOption {
  label: string;
  value: string;
}

export interface RepeaterSubField {
  key: string;
  label: string;
  type: Exclude<NodeInspectorFieldType, 'repeater' | 'list'>;
  placeholder?: string;
  options?: NodeInspectorFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: NodePropValue;
}

export interface NodeInspectorField {
  key: string;
  label: string;
  type: NodeInspectorFieldType;
  basic?: boolean;
  placeholder?: string;
  helperText?: string;
  options?: NodeInspectorFieldOption[];
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: NodePropValue;
  listItemLabel?: string;
  repeaterFields?: RepeaterSubField[];
}

export interface NodeRenderHints {
  display: 'inline' | 'block';
  acceptsChildren: boolean;
}

export interface NodeSchema {
  type: string;
  label: string;
  defaultName: string;
  defaultProps: NodeProps;
  inspectorFields: NodeInspectorField[];
  renderHints: NodeRenderHints;
}

const asProps = (props: Record<string, NodePropValue>): NodeProps => ({ ...props });

export const nodeSchemaRegistry: Record<string, NodeSchema> = {
  section: {
    type: 'section',
    label: 'Section',
    defaultName: 'Section',
    defaultProps: asProps({
      backgroundColor: 'transparent',
      padding: '24px',
      borderRadius: '12px'
    }),
    inspectorFields: [
      { key: 'backgroundColor', label: 'Background', type: 'text', basic: true },
      { key: 'padding', label: 'Padding', type: 'text', placeholder: '24px', basic: true },
      {
        key: 'borderRadius',
        label: 'Border radius',
        type: 'text',
        placeholder: '12px',
        basic: false
      }
    ],
    renderHints: {
      display: 'block',
      acceptsChildren: true
    }
  },
  container: {
    type: 'container',
    label: 'Container',
    defaultName: 'Container',
    defaultProps: asProps({
      columns: 2,
      gap: '16px',
      padding: '24px',
      backgroundColor: 'transparent',
      borderRadius: '12px',
      featureItems: [
        { title: 'Feature one', description: 'Add a clear benefit.' },
        { title: 'Feature two', description: 'Keep copy concise.' }
      ]
    }),
    inspectorFields: [
      {
        key: 'columns',
        label: 'Columns',
        type: 'number',
        min: 1,
        max: 6,
        step: 1,
        defaultValue: 2,
        basic: true
      },
      { key: 'gap', label: 'Gap', type: 'text', placeholder: '16px', basic: true },
      { key: 'padding', label: 'Padding', type: 'text', placeholder: '24px', basic: true },
      { key: 'backgroundColor', label: 'Background', type: 'text', basic: true },
      {
        key: 'borderRadius',
        label: 'Border radius',
        type: 'text',
        placeholder: '12px',
        basic: false
      },
      {
        key: 'featureItems',
        label: 'Feature list',
        type: 'repeater',
        basic: false,
        helperText: 'Useful for cards, FAQ rows, and feature lists.',
        listItemLabel: 'Feature',
        repeaterFields: [
          { key: 'title', label: 'Title', type: 'text', defaultValue: 'Feature title' },
          {
            key: 'description',
            label: 'Description',
            type: 'textarea',
            defaultValue: 'Feature description'
          }
        ],
        defaultValue: []
      }
    ],
    renderHints: {
      display: 'block',
      acceptsChildren: true
    }
  },
  text: {
    type: 'text',
    label: 'Text',
    defaultName: 'Text',
    defaultProps: asProps({
      content: 'Edit text',
      color: 'var(--theme-text-primary, #e2e8f0)',
      margin: '0',
      clampLines: 0
    }),
    inspectorFields: [
      { key: 'content', label: 'Content', type: 'richtext', basic: true },
      { key: 'href', label: 'Link', type: 'link', basic: true },
      {
        key: 'clampLines',
        label: 'Line clamp',
        type: 'range',
        min: 0,
        max: 10,
        step: 1,
        defaultValue: 0,
        basic: false
      }
    ],
    renderHints: {
      display: 'inline',
      acceptsChildren: false
    }
  },
  button: {
    type: 'button',
    label: 'Button',
    defaultName: 'Button',
    defaultProps: asProps({
      label: 'Click me',
      href: '',
      target: '',
      rel: '',
      color: 'var(--theme-text-on-accent, #0f172a)'
    }),
    inspectorFields: [
      { key: 'label', label: 'Label', type: 'text', basic: true },
      { key: 'href', label: 'Link', type: 'link', basic: true },
      {
        key: 'isPrimary',
        label: 'Primary button',
        type: 'toggle',
        defaultValue: true,
        basic: false
      }
    ],
    renderHints: {
      display: 'inline',
      acceptsChildren: false
    }
  },
  image: {
    type: 'image',
    label: 'Image',
    defaultName: 'Image',
    defaultProps: asProps({
      src: '',
      alt: 'Image',
      width: '100%',
      borderRadius: '12px',
      loading: 'lazy',
      tags: []
    }),
    inspectorFields: [
      {
        key: 'src',
        label: 'Image',
        type: 'image',
        placeholder: 'https://example.com/photo.jpg',
        basic: true
      },
      { key: 'alt', label: 'Alt text', type: 'text', basic: true },
      { key: 'caption', label: 'Caption', type: 'textarea', basic: false },
      {
        key: 'loading',
        label: 'Loading',
        type: 'select',
        basic: false,
        options: [
          { label: 'Lazy', value: 'lazy' },
          { label: 'Eager', value: 'eager' }
        ],
        defaultValue: 'lazy'
      },
      {
        key: 'tags',
        label: 'Tags',
        type: 'list',
        listItemLabel: 'Tag',
        basic: false,
        defaultValue: []
      }
    ],
    renderHints: {
      display: 'block',
      acceptsChildren: false
    }
  }
};

export const availableNodeTypes = Object.keys(nodeSchemaRegistry);

export const getNodeSchema = (type: string): NodeSchema | null => nodeSchemaRegistry[type] ?? null;

const readPathParts = (path: string): string[] =>
  path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

export const getNodePropByPath = (node: Node | null, path: string): NodePropValue | undefined => {
  if (!node?.props) {
    return undefined;
  }
  const parts = readPathParts(path);
  let current: NodePropValue | undefined = node.props;
  for (const part of parts) {
    if (Array.isArray(current)) {
      const index = Number.parseInt(part, 10);
      if (Number.isNaN(index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }
    if (typeof current === 'object' && current !== null) {
      current = (current as Record<string, NodePropValue>)[part];
      continue;
    }
    return undefined;
  }
  return current;
};

const asString = (value: NodePropValue | undefined): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
};

export const getNodePropAsString = (node: Node, key: string): string => asString(getNodePropByPath(node, key));

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizePropValue = (value: unknown): NodePropValue => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizePropValue(entry));
  }
  if (isObjectRecord(value)) {
    return Object.entries(value).reduce<Record<string, NodePropValue>>((acc, [key, entry]) => {
      acc[key] = sanitizePropValue(entry);
      return acc;
    }, {});
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null
  ) {
    return value;
  }
  return String(value ?? '');
};

const mergeDefaultProps = (type: string, props: unknown): NodeProps => {
  const schemaDefaults = nodeSchemaRegistry[type]?.defaultProps ?? {};
  const incomingProps = isObjectRecord(props)
    ? Object.entries(props).reduce<NodeProps>((acc, [key, value]) => {
        acc[key] = sanitizePropValue(value);
        return acc;
      }, {})
    : {};

  return {
    ...schemaDefaults,
    ...incomingProps
  };
};

export const migrateNodeTree = (nodes: Node[]): Node[] =>
  nodes.map((node) => {
    const schema = getNodeSchema(node.type);
    return {
      ...node,
      type: node.type,
      name: node.name || schema?.defaultName || node.type,
      props: mergeDefaultProps(node.type, node.props),
      children: node.children?.length ? migrateNodeTree(node.children) : undefined,
      metadata: node.metadata
    };
  });
