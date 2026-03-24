"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardList, Settings } from "lucide-react";
import type { AkteListItem } from "@/lib/extraction/types";
import type { Task, TaskStatus } from "@/lib/storage/task-store";
import { UserSwitcher } from "@/components/custom/CC-09-UserSwitcher";
import { useUser } from "@/lib/user-context";

// ─── Task status config ────────────────────────────────────────────────────────

const STATUS_DOT: Record<TaskStatus, { dot: string; label: string }> = {
  offen:          { dot: "bg-neutral-400",   label: "Offen"          },
  in_bearbeitung: { dot: "bg-brand",         label: "In Bearbeitung" },
  erledigt:       { dot: "bg-success-muted", label: "Erledigt"       },
  abgebrochen:    { dot: "bg-error-muted",   label: "Abgebrochen"    },
};

const STATUS_ORDER: TaskStatus[] = ["in_bearbeitung", "offen", "erledigt", "abgebrochen"];

// ─── Active task slider ────────────────────────────────────────────────────────

function ActiveTaskSlider({ tasks }: { tasks: Task[] }) {
  const [index, setIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset index if tasks change
  useEffect(() => {
    setIndex(0);
  }, [tasks.length]);

  // Auto-advance every 5s when multiple tasks
  useEffect(() => {
    if (tasks.length <= 1) return;
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % tasks.length);
    }, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [tasks.length]);

  const prev = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIndex((i) => (i - 1 + tasks.length) % tasks.length);
  };
  const next = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setIndex((i) => (i + 1) % tasks.length);
  };

  const task = tasks[index];
  if (!task) return null;

  return (
    <div className="flex items-center gap-1 max-w-56 xl:max-w-72">
      {/* pulse dot */}
      <span className="relative flex-shrink-0">
        <span className="absolute inline-flex h-2 w-2 rounded-full bg-brand opacity-75 animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
      </span>

      {/* task title — truncated */}
      <Link
        href={`/aufgaben`}
        className="text-xs text-neutral-700 font-medium truncate hover:text-brand transition-colors"
        title={task.title}
      >
        {task.title}
      </Link>

      {/* navigation (only if multiple) */}
      {tasks.length > 1 && (
        <div className="flex items-center gap-0.5 flex-shrink-0 ml-auto">
          <button
            onClick={prev}
            className="p-0.5 text-neutral-400 hover:text-neutral-600"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <span className="text-[10px] text-neutral-400 tabular-nums">{index + 1}/{tasks.length}</span>
          <button
            onClick={next}
            className="p-0.5 text-neutral-400 hover:text-neutral-600"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── NavBar ────────────────────────────────────────────────────────────────────

export function NavBar() {
  const { currentUser } = useUser();

  const [todoCount, setTodoCount] = useState(0);
  const [aktenStats, setAktenStats] = useState({ gesamt: 0, inBearbeitung: 0, abgeschlossen: 0 });
  const [myTasks, setMyTasks] = useState<Task[]>([]);

  useEffect(() => {
    const loadStats = () => {
      Promise.all([
        fetch("/api/todos").then((r) => r.json()).catch(() => []),
        fetch("/api/unassigned").then((r) => r.json()).catch(() => []),
      ]).then(([todos, unassigned]) => {
        const proposalCount = todos.reduce(
          (sum: number, t: { proposals: unknown[] }) => sum + t.proposals.length,
          0
        );
        setTodoCount(proposalCount + (Array.isArray(unassigned) ? unassigned.length : 0));
      });

      fetch("/api/akten")
        .then((r) => r.json())
        .then((akten: AkteListItem[]) => {
          setAktenStats({
            gesamt: akten.length,
            inBearbeitung: akten.filter(
              (a) => a.status === "review_in_progress" || a.status === "extracting"
            ).length,
            abgeschlossen: akten.filter((a) => a.status === "review_complete").length,
          });
        })
        .catch(() => {});
    };

    loadStats();
    const interval = setInterval(loadStats, 2 * 60 * 1000);
    window.addEventListener("stats-updated", loadStats);
    window.addEventListener("akten-updated", loadStats);
    return () => {
      clearInterval(interval);
      window.removeEventListener("stats-updated", loadStats);
      window.removeEventListener("akten-updated", loadStats);
    };
  }, []);

  // Load tasks for the current user
  useEffect(() => {
    if (!currentUser) return;
    const load = () => {
      fetch(`/api/aufgaben?userId=${currentUser.id}`)
        .then((r) => r.json())
        .then((tasks: Task[]) => setMyTasks(Array.isArray(tasks) ? tasks : []))
        .catch(() => {});
    };
    load();
    window.addEventListener("aufgaben-updated", load);
    return () => window.removeEventListener("aufgaben-updated", load);
  }, [currentUser]);

  // Task counts by status (only non-zero, open + in-progress)
  const countsByStatus = STATUS_ORDER.map((s) => ({
    status: s,
    count: myTasks.filter((t) => t.status === s).length,
    ...STATUS_DOT[s],
  })).filter((s) => s.count > 0 && (s.status === "offen" || s.status === "in_bearbeitung"));

  const activeTasks = myTasks.filter((t) => t.status === "in_bearbeitung");

  const hasTaskInfo = countsByStatus.length > 0 || activeTasks.length > 0;

  // Suppress unused variable warning
  void aktenStats;

  return (
    <header className="border-b bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
        {/* Logo */}
        <Link href="/akten" className="flex items-center gap-2 font-semibold text-neutral-900 flex-shrink-0">
          <Image src="/curaibo_assistant_logo.svg" alt="curAIbo Logo" width={50} height={50}/>
          <Image src="/curaibo_schriftzug.svg" alt="curAIbo Schriftzug" width={190} height={25}/>
        </Link>

        {/* Center: task info */}
        {hasTaskInfo && (
          <div className="flex-1 flex items-center justify-center gap-3 min-w-0">
            {/* Label — links to dedicated page */}
            <Link
              href="/aufgaben"
              className="text-xs font-semibold text-neutral-400 uppercase tracking-wide flex-shrink-0 hover:text-brand transition-colors"
            >
              Meine Aufgaben
            </Link>

            <div className="w-px h-4 bg-neutral-200 flex-shrink-0" />

            {/* Status count pills */}
            {countsByStatus.length > 0 && (
              <div className="flex items-center gap-2">
                {countsByStatus.map(({ status, count, dot, label }) => (
                  <Link
                    key={status}
                    href="/aufgaben"
                    title={`${count} ${label}`}
                    className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 transition-colors"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
                    <span className="font-semibold tabular-nums">{count}</span>
                    <span className="hidden sm:inline text-neutral-400">{label}</span>
                  </Link>
                ))}
              </div>
            )}

            {/* Divider */}
            {countsByStatus.length > 0 && activeTasks.length > 0 && (
              <div className="w-px h-4 bg-neutral-200 flex-shrink-0" />
            )}

            {/* Active task slider */}
            {activeTasks.length > 0 && (
              <ActiveTaskSlider tasks={activeTasks} />
            )}
          </div>
        )}

        {/* Spacer when no task info */}
        {!hasTaskInfo && <div className="flex-1" />}

        {/* Right: Todo + Gear + User */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {todoCount > 0 && (
            <Link
              href="/todos"
              className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-warning-dark bg-warning-light hover:bg-warning-light/80 transition-colors"
              title={`${todoCount} offene Aufgaben`}
            >
              <ClipboardList className="h-4 w-4" />
              <span className="text-xs font-semibold">{todoCount}</span>
            </Link>
          )}
          <Link
            href="/einstellungen"
            className="p-2 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
            title="Einstellungen"
          >
            <Settings className="h-5 w-5" />
          </Link>
          <div className="w-px h-6 bg-neutral-200 mx-1" />
          <UserSwitcher />
        </div>
      </div>
    </header>
  );
}
