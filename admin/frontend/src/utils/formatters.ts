import { CategoryNode } from "../types/integration";

export const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
};

export const getDuration = (started: string, completed: string | null): string => {
  const end = completed ? new Date(completed).getTime() : new Date().getTime();
  const diffMs = end - new Date(started).getTime();
  const seconds = Math.floor(diffMs / 1000);
  const suffix = completed ? "" : " (Devam ediyor...)";
  
  if (seconds < 0) return `0 sn${suffix}`;
  if (seconds < 60) return `${seconds} sn${suffix}`;
  const mins = Math.floor(seconds / 60);
  return `${mins} dk ${seconds % 60} sn${suffix}`;
};

export const getFlatCategoriesList = (
  nodes: CategoryNode[],
  depth = 0
): { id: string; title: string; depth: number; node_path: string }[] => {
  let list: { id: string; title: string; depth: number; node_path: string }[] = [];
  nodes.forEach(node => {
    list.push({ id: node.id, title: node.title, depth, node_path: node.node_path });
    if (node.children && node.children.length > 0) {
      list = [...list, ...getFlatCategoriesList(node.children, depth + 1)];
    }
  });
  return list;
};
