import type { Node, NodePrimitive, NodePropValue, NodeProps } from '../../models';

export type NodeInspectorFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'image'
  | 'repeater';

export interface NodeInspectorFieldOption {
  label: string;
  value: string;
}

export interface NodeInspectorField {
  key: string;
  label: string;
  type: NodeInspectorFieldType;
  placeholder?: string;
  helperText?: string;
  options?: NodeInspectorFieldOption[];
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
      { key: 'backgroundColor', label: 'Background', type: 'text' },
      { key: 'padding', label: 'Padding', type: 'text', placeholder: '24px' },
      { key: 'borderRadius', label: 'Border radius', type: 'text', placeholder: '12px' }
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
      columns: '2',
      gap: '16px',
      padding: '24px',
      backgroundColor: 'transparent',
      borderRadius: '12px'
    }),
    inspectorFields: [
      { key: 'columns', label: 'Columns', type: 'select', options: [
        { label: '1', value: '1' },
        { label: '2', value: '2' },
        { label: '3', value: '3' },
        { label: '4', value: '4' }
      ] },
      { key: 'gap', label: 'Gap', type: 'text', placeholder: '16px' },
      { key: 'padding', label: 'Padding', type: 'text', placeholder: '24px' },
      { key: 'backgroundColor', label: 'Background', type: 'text' },
      { key: 'borderRadius', label: 'Border radius', type: 'text', placeholder: '12px' },
      {
        key: 'items',
        label: 'Repeater items',
        type: 'repeater',
        helperText: 'Optional list data used by advanced renderers.'
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
      margin: '0'
    }),
    inspectorFields: [
      { key: 'content', label: 'Content', type: 'textarea' },
      { key: 'href', label: 'Link URL', type: 'text', placeholder: 'https://example.com' },
      {
        key: 'target',
        label: 'Link target',
        type: 'select',
        options: [
          { label: 'Same tab', value: '' },
          { label: 'New tab', value: '_blank' }
        ]
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
      { key: 'label', label: 'Label', type: 'text' },
      { key: 'href', label: 'Link URL', type: 'text', placeholder: 'https://example.com' },
      {
        key: 'target',
        label: 'Link target',
        type: 'select',
        options: [
          { label: 'Same tab', value: '' },
          { label: 'New tab', value: '_blank' }
        ]
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
      borderRadius: '12px'
    }),
    inspectorFields: [
      { key: 'src', label: 'Image URL', type: 'image', placeholder: 'https://example.com/photo.jpg' },
      { key: 'alt', label: 'Alt text', type: 'text' },
      { key: 'caption', label: 'Caption', type: 'textarea' }
    ],
    renderHints: {
      display: 'block',
      acceptsChildren: false
    }
  }
};

export const availableNodeTypes = Object.keys(nodeSchemaRegistry);

export const getNodeSchema = (type: string): NodeSchema | null => nodeSchemaRegistry[type] ?? null;

const asString = (value: NodePropValue | undefined): string => {
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
};

export const getNodePropAsString = (node: Node, key: string): string => asString(node.props?.[key]);

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizePrimitive = (value: unknown): NodePrimitive => {
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

const sanitizePropValue = (value: unknown): NodePropValue => {
  if (Array.isArray(value)) {
    return value.map(sanitizePrimitive);
  }
  if (isObjectRecord(value)) {
    return Object.entries(value).reduce<Record<string, NodePrimitive>>((acc, [key, entry]) => {
      acc[key] = sanitizePrimitive(entry);
      return acc;
    }, {});
  }
  return sanitizePrimitive(value);
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
