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

const alignmentOptions: NodeInspectorFieldOption[] = [
  { label: 'Start', value: 'flex-start' },
  { label: 'Center', value: 'center' },
  { label: 'End', value: 'flex-end' },
  { label: 'Stretch', value: 'stretch' }
];

const distributionOptions: NodeInspectorFieldOption[] = [
  { label: 'Start', value: 'flex-start' },
  { label: 'Center', value: 'center' },
  { label: 'End', value: 'flex-end' },
  { label: 'Space Between', value: 'space-between' },
  { label: 'Space Around', value: 'space-around' },
  { label: 'Space Evenly', value: 'space-evenly' }
];

const wrapOptions: NodeInspectorFieldOption[] = [
  { label: 'No Wrap', value: 'nowrap' },
  { label: 'Wrap', value: 'wrap' }
];

const baseLayoutFields: NodeInspectorField[] = [
  { key: 'gap', label: 'Gap', type: 'text', placeholder: '16px', basic: true },
  {
    key: 'alignItems',
    label: 'Alignment',
    type: 'select',
    options: alignmentOptions,
    defaultValue: 'stretch',
    basic: true
  },
  {
    key: 'justifyContent',
    label: 'Distribution',
    type: 'select',
    options: distributionOptions,
    defaultValue: 'flex-start',
    basic: true
  },
  {
    key: 'flexWrap',
    label: 'Wrap',
    type: 'select',
    options: wrapOptions,
    defaultValue: 'nowrap',
    basic: false
  },
  { key: 'padding', label: 'Padding', type: 'text', placeholder: '16px', basic: true },
  { key: 'backgroundColor', label: 'Background', type: 'text', basic: false },
  { key: 'borderRadius', label: 'Border radius', type: 'text', placeholder: '12px', basic: false }
];

export const nodeSchemaRegistry: Record<string, NodeSchema> = {

  'component-instance': {
    type: 'component-instance',
    label: 'Component Instance',
    defaultName: 'Component Instance',
    defaultProps: asProps({}),
    inspectorFields: [],
    renderHints: {
      display: 'block',
      acceptsChildren: false
    }
  },
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
      { key: 'borderRadius', label: 'Border radius', type: 'text', placeholder: '12px', basic: false }
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
      ...baseLayoutFields,
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
  stack: {
    type: 'stack',
    label: 'Stack',
    defaultName: 'Stack',
    defaultProps: asProps({
      direction: 'column',
      gap: '16px',
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      flexWrap: 'nowrap',
      padding: '0',
      backgroundColor: 'transparent',
      borderRadius: '0'
    }),
    inspectorFields: [
      {
        key: 'direction',
        label: 'Direction',
        type: 'select',
        options: [
          { label: 'Vertical', value: 'column' },
          { label: 'Horizontal', value: 'row' }
        ],
        defaultValue: 'column',
        basic: true
      },
      ...baseLayoutFields
    ],
    renderHints: {
      display: 'block',
      acceptsChildren: true
    }
  },
  row: {
    type: 'row',
    label: 'Row',
    defaultName: 'Row',
    defaultProps: asProps({
      gap: '16px',
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      flexWrap: 'nowrap',
      padding: '0',
      backgroundColor: 'transparent',
      borderRadius: '0'
    }),
    inspectorFields: baseLayoutFields,
    renderHints: {
      display: 'block',
      acceptsChildren: true
    }
  },
  column: {
    type: 'column',
    label: 'Column',
    defaultName: 'Column',
    defaultProps: asProps({
      gap: '12px',
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      flexWrap: 'nowrap',
      padding: '0',
      backgroundColor: 'transparent',
      borderRadius: '0'
    }),
    inspectorFields: baseLayoutFields,
    renderHints: {
      display: 'block',
      acceptsChildren: true
    }
  },
  grid: {
    type: 'grid',
    label: 'Grid',
    defaultName: 'Grid',
    defaultProps: asProps({
      columns: 3,
      minColumnWidth: '220px',
      gap: '16px',
      alignItems: 'stretch',
      justifyContent: 'stretch',
      padding: '0',
      backgroundColor: 'transparent',
      borderRadius: '0'
    }),
    inspectorFields: [
      {
        key: 'columns',
        label: 'Columns',
        type: 'number',
        min: 1,
        max: 8,
        step: 1,
        defaultValue: 3,
        basic: true
      },
      { key: 'minColumnWidth', label: 'Min column width', type: 'text', placeholder: '220px', basic: true },
      ...baseLayoutFields.filter((field) => field.key !== 'flexWrap')
    ],
    renderHints: {
      display: 'block',
      acceptsChildren: true
    }
  },
  card: {
    type: 'card',
    label: 'Card',
    defaultName: 'Card',
    defaultProps: asProps({
      gap: '12px',
      alignItems: 'stretch',
      justifyContent: 'flex-start',
      flexWrap: 'nowrap',
      padding: '20px',
      backgroundColor: 'var(--theme-surface-elevated, rgba(30, 41, 59, 0.7))',
      borderRadius: 'var(--theme-radius-lg, 16px)'
    }),
    inspectorFields: baseLayoutFields,
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
      showOutline: true,
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
      {
        key: 'showOutline',
        label: 'Show outline',
        type: 'toggle',
        defaultValue: true,
        basic: true
      },
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
  },
  form: {
    type: 'form',
    label: 'Form',
    defaultName: 'Form',
    defaultProps: asProps({
      title: 'Contact us',
      description: 'Use this form to collect lead details from your live page.',
      submitLabel: 'Submit',
      successMessage: 'Thanks — we received your submission.',
      fields: [
        { key: 'name', label: 'Name', type: 'text', placeholder: 'Your name', required: true },
        { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', required: true },
        { key: 'message', label: 'Message', type: 'textarea', placeholder: 'How can we help?', required: false }
      ]
    }),
    inspectorFields: [
      { key: 'title', label: 'Title', type: 'text', basic: true },
      { key: 'description', label: 'Description', type: 'textarea', basic: true },
      { key: 'submitLabel', label: 'Submit label', type: 'text', basic: true },
      { key: 'successMessage', label: 'Success message', type: 'text', basic: false },
      {
        key: 'fields',
        label: 'Fields',
        type: 'repeater',
        basic: true,
        listItemLabel: 'Field',
        defaultValue: [],
        repeaterFields: [
          { key: 'key', label: 'Key', type: 'text', defaultValue: 'field' },
          { key: 'label', label: 'Label', type: 'text', defaultValue: 'Field label' },
          {
            key: 'type',
            label: 'Type',
            type: 'select',
            defaultValue: 'text',
            options: [
              { label: 'Text', value: 'text' },
              { label: 'Email', value: 'email' },
              { label: 'Tel', value: 'tel' },
              { label: 'Textarea', value: 'textarea' }
            ]
          },
          { key: 'placeholder', label: 'Placeholder', type: 'text', defaultValue: '' },
          { key: 'required', label: 'Required', type: 'toggle', defaultValue: false }
        ]
      }
    ],
    renderHints: {
      display: 'block',
      acceptsChildren: false
    }
  },
  poll: {
    type: 'poll',
    label: 'Poll',
    defaultName: 'Poll',
    defaultProps: asProps({
      question: 'Which launch channel should we prioritize?',
      submitLabel: 'Vote',
      options: [
        { label: 'Email campaign' },
        { label: 'Creator partnership' },
        { label: 'Paid social' }
      ]
    }),
    inspectorFields: [
      { key: 'question', label: 'Question', type: 'textarea', basic: true },
      { key: 'submitLabel', label: 'Button label', type: 'text', basic: true },
      {
        key: 'options',
        label: 'Options',
        type: 'repeater',
        basic: true,
        listItemLabel: 'Option',
        defaultValue: [],
        repeaterFields: [{ key: 'label', label: 'Label', type: 'text', defaultValue: 'Option' }]
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
