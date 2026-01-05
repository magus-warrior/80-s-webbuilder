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
  updateNodeName: (nodeId: string, name: string) => void;
  addNode: (node: Node) => void;
  addNodeToContainer: (containerId: string, node: Node) => void;
  moveNodeWithinParent: (parentId: string | null, sourceId: string, targetId: string) => void;
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

const reorderNodes = (nodes: Node[], sourceId: string, targetId: string): Node[] => {
  const sourceIndex = nodes.findIndex((node) => node.id === sourceId);
  const targetIndex = nodes.findIndex((node) => node.id === targetId);

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return nodes;
  }

  const nextNodes = [...nodes];
  const [moved] = nextNodes.splice(sourceIndex, 1);
  const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  nextNodes.splice(insertIndex, 0, moved);

  return nextNodes;
};

const moveNodeInTree = (
  nodes: Node[],
  parentId: string | null,
  sourceId: string,
  targetId: string
): Node[] => {
  if (!parentId) {
    return reorderNodes(nodes, sourceId, targetId);
  }

  let didUpdate = false;
  const nextNodes = nodes.map((node) => {
    if (node.id === parentId) {
      const nextChildren = reorderNodes(node.children ?? [], sourceId, targetId);
      if (nextChildren === node.children) {
        return node;
      }
      didUpdate = true;
      return {
        ...node,
        children: nextChildren
      };
    }

    if (!node.children) {
      return node;
    }

    const nextChildren = moveNodeInTree(node.children, parentId, sourceId, targetId);
    if (nextChildren === node.children) {
      return node;
    }
    didUpdate = true;
    return {
      ...node,
      children: nextChildren
    };
  });

  return didUpdate ? nextNodes : nodes;
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
  updateNodeName: (nodeId, name) =>
    set((state) => ({
      nodes: updateNodeTree(state.nodes, nodeId, (node) => ({
        ...node,
        name
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
    })),
  moveNodeWithinParent: (parentId, sourceId, targetId) =>
    set((state) => ({
      nodes: moveNodeInTree(state.nodes, parentId, sourceId, targetId)
    }))
}));
