import { create } from 'zustand';

import type { Node } from '../models';

type EditorState = {
  nodes: Node[];
  selectedNodeId: string | null;
  currentPageId: string | null;
  setSelectedNodeId: (nodeId: string | null) => void;
  setCurrentPageId: (pageId: string | null) => void;
  setNodes: (nodes: Node[]) => void;
  updateNodeProps: (nodeId: string, updates: Record<string, string>) => void;
  addNode: (node: Node) => void;
  addNodeToContainer: (containerId: string, node: Node) => void;
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

const addNodeToTree = (nodes: Node[], containerId: string, nodeToAdd: Node): Node[] => {
  let didInsert = false;
  const nextNodes = nodes.map((node) => {
    if (node.id === containerId) {
      didInsert = true;
      return {
        ...node,
        children: [...(node.children ?? []), nodeToAdd]
      };
    }

    if (!node.children) {
      return node;
    }

    const nextChildren = addNodeToTree(node.children, containerId, nodeToAdd);

    if (nextChildren === node.children) {
      return node;
    }

    didInsert = true;
    return {
      ...node,
      children: nextChildren
    };
  });

  return didInsert ? nextNodes : nodes;
};

export const useEditorStore = create<EditorState>((set) => ({
  nodes: [],
  selectedNodeId: null,
  currentPageId: null,
  setSelectedNodeId: (nodeId) => set({ selectedNodeId: nodeId }),
  setCurrentPageId: (pageId) => set({ currentPageId: pageId, selectedNodeId: null }),
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
    })),
  addNode: (node) =>
    set((state) => ({
      nodes: [...state.nodes, node],
      selectedNodeId: node.id
    })),
  addNodeToContainer: (containerId, node) =>
    set((state) => ({
      nodes: addNodeToTree(state.nodes, containerId, node),
      selectedNodeId: node.id
    }))
}));
