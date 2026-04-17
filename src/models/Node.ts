export type NodePrimitive = string | number | boolean | null;
export type NodePropValue = NodePrimitive | NodePrimitive[] | Record<string, NodePrimitive>;
export type NodeProps = Record<string, NodePropValue>;

export interface NodeMetadata {
  inspector?: {
    collapsedSections?: string[];
    hiddenFields?: string[];
  };
  editor?: {
    locked?: boolean;
    hiddenFromLayers?: boolean;
  };
  [key: string]: NodePropValue | undefined;
}

export interface Node {
  id: string;
  type: string;
  name: string;
  props?: NodeProps;
  children?: Node[];
  metadata?: NodeMetadata;
}
