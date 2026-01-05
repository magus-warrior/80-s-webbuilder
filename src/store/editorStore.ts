import { create } from 'zustand';

import type { Node } from '../models';

type EditorState = {
  nodes: Node[];
  selectedNodeId: string | null;
  currentPageId: string | null;
  historyPast: EditorSnapshot[];
  historyFuture: EditorSnapshot[];
  setSelectedNodeId: (nodeId: string | null) => void;
  setCurrentPageId: (pageId: string | null) => void;
  setNodes: (nodes: Node[]) => void;
  updateNodeProps: (
    nodeId: string,
    updates: Record<string, string>,
    options?: { history?: HistoryMode }
  ) => void;
  updateNodeName: (nodeId: string, name: string) => void;
  addNode: (node: Node) => void;
  addNodeToContainer: (containerId: string, node: Node) => void;
  moveNodeWithinParent: (parentId: string | null, sourceId: string, targetId: string) => void;
  undo: () => void;
  redo: () => void;
};

type EditorSnapshot = {
  nodes: Node[];
  selectedNodeId: string | null;
  currentPageId: string | null;
};

type HistoryMode = 'immediate' | 'debounced' | 'none';

const HISTORY_LIMIT = 50;
const HISTORY_DEBOUNCE_MS = 200;

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

export const useEditorStore = create<EditorState>((set, get) => {
  let pendingSnapshot: EditorSnapshot | null = null;
  let historyTimeout: ReturnType<typeof setTimeout> | null = null;

  const snapshotState = (state: EditorState): EditorSnapshot => ({
    nodes: state.nodes,
    selectedNodeId: state.selectedNodeId,
    currentPageId: state.currentPageId
  });

  const commitPendingSnapshot = () => {
    if (!pendingSnapshot) {
      return;
    }
    const snapshot = pendingSnapshot;
    pendingSnapshot = null;
    if (historyTimeout) {
      clearTimeout(historyTimeout);
      historyTimeout = null;
    }
    set((state) => ({
      historyPast: [...state.historyPast, snapshot].slice(-HISTORY_LIMIT)
    }));
  };

  const queueSnapshot = () => {
    if (!pendingSnapshot) {
      pendingSnapshot = snapshotState(get());
    }
    if (historyTimeout) {
      clearTimeout(historyTimeout);
    }
    historyTimeout = setTimeout(() => {
      const snapshot = pendingSnapshot;
      pendingSnapshot = null;
      historyTimeout = null;
      if (!snapshot) {
        return;
      }
      set((state) => ({
        historyPast: [...state.historyPast, snapshot].slice(-HISTORY_LIMIT)
      }));
    }, HISTORY_DEBOUNCE_MS);
  };

  const pushSnapshot = () => {
    commitPendingSnapshot();
    set((state) => ({
      historyPast: [...state.historyPast, snapshotState(state)].slice(-HISTORY_LIMIT),
      historyFuture: []
    }));
  };

  return {
    nodes: [],
    selectedNodeId: null,
    currentPageId: null,
    historyPast: [],
    historyFuture: [],
    setSelectedNodeId: (nodeId) => {
      if (get().selectedNodeId === nodeId) {
        return;
      }
      pushSnapshot();
      set(() => ({
        selectedNodeId: nodeId
      }));
    },
    setCurrentPageId: (pageId) => {
      if (get().currentPageId === pageId) {
        return;
      }
      pushSnapshot();
      set(() => ({
        currentPageId: pageId,
        selectedNodeId: null
      }));
    },
    setNodes: (nodes) => {
      pushSnapshot();
      set(() => ({
        nodes
      }));
    },
    updateNodeProps: (nodeId, updates, options) => {
      const historyMode = options?.history ?? 'immediate';
      if (historyMode === 'immediate') {
        pushSnapshot();
      }
      if (historyMode === 'debounced') {
        queueSnapshot();
        set((state) => ({
          historyFuture: []
        }));
      }
      set((state) => ({
        nodes: updateNodeTree(state.nodes, nodeId, (node) => ({
          ...node,
          props: {
            ...(node.props ?? {}),
            ...updates
          }
        }))
      }));
    },
    updateNodeName: (nodeId, name) => {
      pushSnapshot();
      set((state) => ({
        nodes: updateNodeTree(state.nodes, nodeId, (node) => ({
          ...node,
          name
        }))
      }));
    },
    addNode: (node) => {
      pushSnapshot();
      set((state) => ({
        nodes: [...state.nodes, node],
        selectedNodeId: node.id
      }));
    },
    addNodeToContainer: (containerId, node) => {
      pushSnapshot();
      set((state) => ({
        nodes: addNodeToTree(state.nodes, containerId, node),
        selectedNodeId: node.id
      }));
    },
    moveNodeWithinParent: (parentId, sourceId, targetId) => {
      pushSnapshot();
      set((state) => ({
        nodes: moveNodeInTree(state.nodes, parentId, sourceId, targetId)
      }));
    },
    undo: () => {
      commitPendingSnapshot();
      set((state) => {
        if (state.historyPast.length === 0) {
          return state;
        }
        const previous = state.historyPast[state.historyPast.length - 1];
        const nextPast = state.historyPast.slice(0, -1);
        return {
          nodes: previous.nodes,
          selectedNodeId: previous.selectedNodeId,
          currentPageId: previous.currentPageId,
          historyPast: nextPast,
          historyFuture: [snapshotState(state), ...state.historyFuture]
        };
      });
    },
    redo: () => {
      commitPendingSnapshot();
      set((state) => {
        if (state.historyFuture.length === 0) {
          return state;
        }
        const next = state.historyFuture[0];
        const remaining = state.historyFuture.slice(1);
        return {
          nodes: next.nodes,
          selectedNodeId: next.selectedNodeId,
          currentPageId: next.currentPageId,
          historyPast: [...state.historyPast, snapshotState(state)].slice(-HISTORY_LIMIT),
          historyFuture: remaining
        };
      });
    }
  };
});
