// Drag & Drop types for CURAIBO task creation via drag interaction.
// User drags a user card onto an element (or vice versa) to create a task.
// Communication between components uses a CustomEvent on window.

export const DRAG_KEY = "application/x-curaibo-drag";
export const AUFGABE_CREATE_EVENT = "aufgabe-create-request";
export const AUFGABE_ASSIGNEE_ADD_EVENT = "aufgabe-assignee-add-request";

export type DragSource =
  | { kind: "user"; userId: string }
  | { kind: "task"; taskId: string }
  | { kind: "akte"; caseId: string; label?: string }
  | { kind: "beteiligter"; caseId: string; groupId: string; beteiligterId: string; label?: string }
  | { kind: "dokument"; caseId: string; folder: string; filename: string }
  | { kind: "feldgruppe"; caseId: string; groupId: string; instanceIndex?: number; label?: string }
  | { kind: "vorschlag"; caseId: string; proposalId: string; fieldLabel: string; folder: string; filename: string; groupId: string; fieldId: string };

export interface AssigneeAddDetail {
  taskId: string;
  userId: string;
}

export type DropTarget = DragSource;

export interface DragPayload {
  source: DragSource;
}

export interface AufgabeCreateDetail {
  draggedSource: DragSource;
  dropTarget: DropTarget;
}
