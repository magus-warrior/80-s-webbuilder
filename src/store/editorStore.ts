import { create } from 'zustand';

import type { Node, NodePropValue, NodeProps } from '../models';

type EditorState = {
  nodes: Node[];
  selectedNodeId: string | null;
  currentPageId: string | null;
  gridSize: number;
  historyPast: EditorSnapshot[];
  historyFuture: EditorSnapshot[];
  setSelectedNodeId: (nodeId: string | null) => void;
  setCurrentPageId: (pageId: string | null) => void;
  setNodes: (nodes: Node[]) => void;
  setGridSize: (gridSize: number) => void;
  updateNodeProps: (
    nodeId: string,
    updates: Record<string, NodePropValue>,
    options?: { history?: HistoryMode }
  ) => void;
  updateNodeName: (nodeId: string, name: string) => void;
  removeNode: (nodeId: string) => void;
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


const parsePath = (key: string): string[] =>
  key
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean);

const cloneContainer = (value: NodePropValue | NodeProps | undefined): NodePropValue | NodeProps => {
  if (Array.isArray(value)) {
    return [...value];
  }
  if (typeof value === 'object' && value !== null) {
    return { ...value };
  }
  return {};
};

const setPropAtPath = (base: NodeProps, key: string, value: NodePropValue): NodeProps => {
  const path = parsePath(key);
  if (path.length <= 1) {
    return {
      ...base,
      [key]: value
    };
  }

  const root = { ...base } as NodeProps;
  let current: NodePropValue | NodeProps = root;

  path.forEach((segment, index) => {
    const isLast = index === path.length - 1;
    const nextSegment = path[index + 1];

    if (Array.isArray(current)) {
      const targetIndex = Number.parseInt(segment, 10);
      if (Number.isNaN(targetIndex)) {
        return;
      }
      if (isLast) {
        current[targetIndex] = value;
        return;
      }
      const existing = current[targetIndex];
      const nextValue =
        existing !== undefined
          ? cloneContainer(existing)
          : Number.isNaN(Number.parseInt(nextSegment ?? '', 10))
            ? {}
            : [];
      current[targetIndex] = nextValue as NodePropValue;
      current = nextValue;
      return;
    }

    if (typeof current !== 'object' || current === null) {
      return;
    }

    const record = current as NodeProps;
    if (isLast) {
      record[segment] = value;
      return;
    }

    const existing = record[segment];
    const nextValue =
      existing !== undefined
        ? cloneContainer(existing)
        : Number.isNaN(Number.parseInt(nextSegment ?? '', 10))
          ? {}
          : [];
    record[segment] = nextValue as NodePropValue;
    current = nextValue;
  });

  return root;
};

const mergeNodeProps = (existing: NodeProps | undefined, updates: Record<string, NodePropValue>): NodeProps => {
  let nextProps: NodeProps = { ...(existing ?? {}) };
  Object.entries(updates).forEach(([key, value]) => {
    nextProps = setPropAtPath(nextProps, key, value);
  });
  return nextProps;
};

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

const removeNodeFromTree = (nodes: Node[], nodeId: string): Node[] => {
  let didRemove = false;
  const nextNodes = nodes.flatMap((node) => {
    if (node.id === nodeId) {
      didRemove = true;
      return [];
    }

    if (!node.children) {
      return [node];
    }

    const nextChildren = removeNodeFromTree(node.children, nodeId);
    if (nextChildren === node.children) {
      return [node];
    }

    didRemove = true;
    return [
      {
        ...node,
        children: nextChildren
      }
    ];
  });

  return didRemove ? nextNodes : nodes;
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
    gridSize: 16,
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
      console.info('[editor] setNodes', {
        nextCount: nodes.length
      });
      set(() => ({
        nodes
      }));
    },
    setGridSize: (gridSize) => {
      set(() => ({
        gridSize
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
          props: mergeNodeProps(node.props, updates)
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
    removeNode: (nodeId) => {
      const currentNodes = get().nodes;
      const nextNodes = removeNodeFromTree(currentNodes, nodeId);
      if (nextNodes === currentNodes) {
        return;
      }
      pushSnapshot();
      console.info('[editor] removeNode', {
        id: nodeId,
        previousCount: currentNodes.length,
        nextCount: nextNodes.length
      });
      set((state) => ({
        nodes: nextNodes,
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
      }));
    },
    addNode: (node) => {
      pushSnapshot();
      console.info('[editor] addNode', {
        id: node.id,
        type: node.type,
        name: node.name,
        childrenCount: node.children?.length ?? 0
      });
      set((state) => ({
        nodes: [...state.nodes, node],
        selectedNodeId: node.id
      }));
    },
    addNodeToContainer: (containerId, node) => {
      pushSnapshot();
      console.info('[editor] addNodeToContainer', {
        containerId,
        id: node.id,
        type: node.type,
        name: node.name,
        childrenCount: node.children?.length ?? 0
      });
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
