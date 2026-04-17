import type {
  ComponentFamily,
  ComponentInstanceMetadata,
  ComponentOverrideCategory,
  ComponentVariant,
  Node,
  NodePropValue
} from '../../models';

export interface ComponentOverrideField {
  key: string;
  label: string;
  category: ComponentOverrideCategory;
  nodeName: string;
  sourceValue: NodePropValue;
}

const textKeys = new Set(['content', 'label']);
const imageKeys = new Set(['src', 'alt']);
const linkKeys = new Set(['href', 'target', 'rel']);
const styleKeys = new Set([
  'color',
  'background',
  'backgroundColor',
  'fontSize',
  'padding',
  'margin',
  'borderRadius',
  'gap',
  'fontWeight',
  'textAlign',
  'justifyContent',
  'alignItems',
  'width',
  'height'
]);

const categoryForKey = (key: string): ComponentOverrideCategory | null => {
  if (textKeys.has(key)) return 'text';
  if (imageKeys.has(key)) return 'image';
  if (linkKeys.has(key)) return 'link';
  if (styleKeys.has(key)) return 'style';
  return null;
};

const cloneNode = (node: Node): Node => ({
  ...node,
  props: node.props ? { ...node.props } : undefined,
  children: node.children?.map(cloneNode)
});

const getNodeAtPath = (root: Node, path: string): Node | null => {
  if (path === 'root') {
    return root;
  }
  const indices = path
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => !Number.isNaN(part));
  let current: Node | undefined = root;
  for (const index of indices) {
    current = current?.children?.[index];
    if (!current) return null;
  }
  return current ?? null;
};

const parseOverrideKey = (key: string): { path: string; prop: string } | null => {
  const [path, prop] = key.split(':');
  if (!path || !prop) return null;
  return { path, prop };
};

export const createComponentId = (prefix: string) => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const isComponentInstanceNode = (node: Node): boolean => node.type === 'component-instance';

export const getComponentInstanceMetadata = (node: Node): ComponentInstanceMetadata | null => {
  const metadata = node.metadata?.componentInstance as ComponentInstanceMetadata | undefined;
  if (!metadata?.familyId || !metadata.variantId) {
    return null;
  }
  return metadata;
};

export const createComponentInstanceNode = (
  family: ComponentFamily,
  variant: ComponentVariant,
  name?: string
): Node => ({
  id: createComponentId('node'),
  type: 'component-instance',
  name: name ?? `${family.name} / ${variant.name}`,
  props: {
    familyId: family.id,
    variantId: variant.id
  },
  metadata: {
    componentInstance: {
      familyId: family.id,
      variantId: variant.id,
      overrides: {}
    }
  }
});

export const resolveComponentInstanceNode = (
  node: Node,
  families: ComponentFamily[]
): Node | null => {
  const metadata = getComponentInstanceMetadata(node);
  if (!metadata) {
    return null;
  }
  const family = families.find((item) => item.id === metadata.familyId);
  const variant = family?.variants.find((item) => item.id === metadata.variantId);
  if (!variant || !family) {
    return null;
  }

  const resolved = cloneNode(variant.rootNode);
  const overrides = metadata.overrides ?? {};
  Object.entries(overrides).forEach(([overrideKey, value]) => {
    const parsed = parseOverrideKey(overrideKey);
    if (!parsed) return;
    const target = getNodeAtPath(resolved, parsed.path);
    if (!target) return;
    target.props = {
      ...(target.props ?? {}),
      [parsed.prop]: value
    };
  });

  resolved.id = node.id;
  resolved.name = node.name;
  resolved.metadata = {
    ...(resolved.metadata ?? {}),
    sourceComponent: {
      familyId: family.id,
      familyName: family.name,
      variantId: variant.id,
      variantName: variant.name
    }
  };
  return resolved;
};

export const collectComponentOverrideFields = (rootNode: Node): ComponentOverrideField[] => {
  const fields: ComponentOverrideField[] = [];

  const visit = (node: Node, path: string) => {
    Object.entries(node.props ?? {}).forEach(([key, value]) => {
      const category = categoryForKey(key);
      if (!category) {
        return;
      }
      fields.push({
        key: `${path}:${key}`,
        label: `${node.name} · ${key}`,
        category,
        nodeName: node.name,
        sourceValue: value
      });
    });

    node.children?.forEach((child, index) => {
      const childPath = path === 'root' ? `${index}` : `${path}.${index}`;
      visit(child, childPath);
    });
  };

  visit(rootNode, 'root');
  return fields;
};
