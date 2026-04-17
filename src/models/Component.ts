import type { Node, NodePropValue } from './Node';

export type ComponentOverrideCategory = 'text' | 'image' | 'link' | 'style';

export interface ComponentVariant {
  id: string;
  name: string;
  rootNode: Node;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentFamily {
  id: string;
  name: string;
  description?: string;
  variants: ComponentVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ComponentInstanceMetadata {
  familyId: string;
  variantId: string;
  overrides?: Record<string, NodePropValue>;
}

export interface PageComponentInstance {
  nodeId: string;
  familyId: string;
  variantId: string;
  overrides?: Record<string, NodePropValue>;
}
