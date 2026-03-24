"use client";

import { useEffect, useState } from "react";
import { UserProvider } from "@/lib/user-context";
import { NavBar } from "@/components/custom/CC-07-NavBar";
import { ChatPanel } from "@/components/custom/CC-08-ChatPanel";
import { GlobalAktenSidebar } from "@/components/custom/CC-11-GlobalAktenSidebar";
import { TeamSidebar } from "@/components/custom/CC-10-TeamSidebar";
import { TaskCreationModal } from "@/components/custom/CC-13-TaskCreationModal";
import type { AufgabeCreateDetail, AssigneeAddDetail } from "@/lib/drag-types";
import { AUFGABE_CREATE_EVENT, AUFGABE_ASSIGNEE_ADD_EVENT } from "@/lib/drag-types";
import type { Task } from "@/lib/storage/task-store";

function ClientShellInner({ children }: { children: React.ReactNode }) {
  const [aufgabePayload, setAufgabePayload] = useState<AufgabeCreateDetail | null>(null);

  useEffect(() => {
    const handleCreate = (e: Event) => {
      setAufgabePayload((e as CustomEvent<AufgabeCreateDetail>).detail);
    };
    const handleAssigneeAdd = async (e: Event) => {
      const { taskId, userId } = (e as CustomEvent<AssigneeAddDetail>).detail;
      try {
        const taskRes = await fetch(`/api/aufgaben/${taskId}`);
        if (!taskRes.ok) return;
        const task: Task = await taskRes.json();
        if (task.assignees.includes(userId)) return; // already assigned
        await fetch(`/api/aufgaben/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignees: [...task.assignees, userId] }),
        });
        window.dispatchEvent(new Event("aufgaben-updated"));
      } catch { /* ignore */ }
    };
    window.addEventListener(AUFGABE_CREATE_EVENT, handleCreate);
    window.addEventListener(AUFGABE_ASSIGNEE_ADD_EVENT, handleAssigneeAdd);
    return () => {
      window.removeEventListener(AUFGABE_CREATE_EVENT, handleCreate);
      window.removeEventListener(AUFGABE_ASSIGNEE_ADD_EVENT, handleAssigneeAdd);
    };
  }, []);

  const handleCreated = (_task: Task) => {
    setAufgabePayload(null);
    window.dispatchEvent(new Event("aufgaben-updated"));
  };

  return (
    <>
      <NavBar />
      <div className="flex h-[calc(100vh-3.5rem)]">
        <GlobalAktenSidebar />
        <main className="flex-1 overflow-auto min-w-0">{children}</main>
        <TeamSidebar />
      </div>
      <ChatPanel />
      <TaskCreationModal
        payload={aufgabePayload}
        onClose={() => setAufgabePayload(null)}
        onCreated={handleCreated}
      />
    </>
  );
}

export function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <UserProvider>
      <ClientShellInner>{children}</ClientShellInner>
    </UserProvider>
  );
}
