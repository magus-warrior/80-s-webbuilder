import { create } from 'zustand';

import type { Node } from '../models';

type EditorState = {
  nodes: Node[];
  selectedNodeId: string | null;
  setSelectedNodeId: (nodeId: string | null) => void;
  setNodes: (nodes: Node[]) => void;
  updateNodeProps: (nodeId: string, updates: Record<string, string>) => void;
};

const updateNodeTree = (
  nodes: Node[],
  nodeId: string,
  updater: (node: Node) => Node
): Node[] =>
  nodes.map((node) => {
    if (node.id === nodeId) {
      return updater(node);
    }

    if (!node.children) {
      return node;
    }

    const nextChildren = updateNodeTree(node.children, nodeId, updater);

    if (nextChildren === node.children) {
      return node;
    }

    return {
      ...node,
      children: nextChildren
    };
  });

export const useEditorStore = create<EditorState>((set) => ({
  nodes: [],
  selectedNodeId: null,
  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
  setNodes: (nodes) => set({ nodes }),
  updateNodeProps: (nodeId, updates) =>
    set((state) => ({
      nodes: updateNodeTree(state.nodes, nodeId, (node) => ({
        ...node,
        props: {
          ...(node.props ?? {}),
          ...updates
        }
      }))
    }))
}));
