"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { TextStreamChatTransport } from "ai";
import type { UIMessage } from "ai";
import { X, Send, Bot, User, Loader2, FolderOpen, GripHorizontal } from "lucide-react";

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [schuldnerName, setSchuldnerName] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  // caseId aus URL extrahieren
  const pathname = usePathname();
  const caseIdMatch = pathname.match(/\/cases\/([^/]+)\/review/);
  const caseId = caseIdMatch?.[1] ?? null;

  // Ref für dynamischen caseId-Zugriff im Transport
  const caseIdRef = useRef(caseId);
  useEffect(() => { caseIdRef.current = caseId; }, [caseId]);

  // Schuldnername laden wenn caseId bekannt
  useEffect(() => {
    if (!caseId) { setSchuldnerName(null); return; }
    fetch(`/api/cases/${caseId}`)
      .then((r) => r.json())
      .then((data) => setSchuldnerName(data?.schuldnerName ?? null))
      .catch(() => setSchuldnerName(null));
  }, [caseId]);

  const { messages, sendMessage, status } = useChat({
    transport: new TextStreamChatTransport({
      api: "/api/chat",
      body: () => ({ caseId: caseIdRef.current }),
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;
    setInputText("");
    await sendMessage({ text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: rect.left,
      startPosY: rect.top,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newX = Math.max(0, Math.min(window.innerWidth - 384, dragRef.current.startPosX + dx));
      const newY = Math.max(0, Math.min(window.innerHeight - 600, dragRef.current.startPosY + dy));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const unreadCount = isOpen ? 0 : messages.filter((m: UIMessage) => m.role === "assistant").length;

  const panelStyle = position
    ? { left: position.x, top: position.y, bottom: "auto", right: "auto" }
    : undefined;

  const panelVisibilityClass = position
    ? isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
    : isOpen ? "translate-x-0 translate-y-0" : "translate-x-full";

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-brand hover:bg-brand-hover text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        title="KI-Assistent öffnen"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <div className="relative">
            <img src="/curaibo_paragraph_assistant.svg" alt="KI-Assistent" className="w-10 h-10 object-contain" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Chat Panel */}
      <div
        ref={panelRef}
        style={panelStyle}
        className={`fixed z-40 h-[600px] w-96 bg-white shadow-2xl border-l border-t rounded-tl-2xl flex flex-col transition-all duration-300 ${
          !position ? "bottom-0 right-0" : ""
        } ${panelVisibilityClass}`}
      >
        {/* Header / Drag Handle */}
        <div
          onMouseDown={handleDragStart}
          className="flex items-center justify-between px-4 py-3 border-b bg-neutral-50 rounded-tl-2xl cursor-grab active:cursor-grabbing select-none"
        >
          <div className="flex items-center gap-2">
            <GripHorizontal className="h-4 w-4 text-neutral-400" />
            <Bot className="h-5 w-5 text-brand" />
            <span className="font-semibold text-neutral-900 text-sm">KI-Assistent</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="text-xs bg-brand-light text-brand-text px-2 py-0.5 rounded-full flex items-center gap-1">
              <FolderOpen className="h-3 w-3" /> Alle Akten
            </span>
            {caseId && (
              <span className="text-xs bg-success-light text-success-text px-2 py-0.5 rounded-full">
                {schuldnerName ? `Aktiv: ${schuldnerName}` : "Aktive Akte"}
              </span>
            )}
            <button
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => setIsOpen(false)}
              className="ml-1 text-neutral-400 hover:text-neutral-600 transition-colors"
              title="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-8 text-neutral-400">
              <Bot className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-neutral-600">Wie kann ich helfen?</p>
              <p className="text-xs mt-1">
                Fragen Sie zu Akten, Verfahren,<br />Gläubigern oder Fristen.
              </p>
              <div className="mt-4 space-y-1.5">
                {[
                  "Welche Akten sind noch in Bearbeitung?",
                  "Wie viele Gläubiger hat Müller?",
                  "Was bedeutet RSB?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInputText(suggestion)}
                    className="block w-full text-left text-xs bg-neutral-50 hover:bg-neutral-100 px-3 py-1.5 rounded-lg text-neutral-600 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg: UIMessage) => {
            const textContent = msg.parts
              ? msg.parts
                  .filter((p: { type: string }) => p.type === "text")
                  .map((p: { type: string; text?: string }) => p.text ?? "")
                  .join("")
              : "";

            return (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                  msg.role === "user" ? "bg-brand" : "bg-neutral-200"
                }`}>
                  {msg.role === "user" ? (
                    <User className="h-3.5 w-3.5 text-white" />
                  ) : (
                    <Bot className="h-3.5 w-3.5 text-neutral-600" />
                  )}
                </div>
                <div
                  className={`max-w-[78%] text-sm rounded-2xl px-3 py-2 whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-brand text-white rounded-tr-sm"
                      : "bg-neutral-100 text-neutral-900 rounded-tl-sm"
                  }`}
                >
                  {textContent}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex gap-2">
              <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0">
                <Bot className="h-3.5 w-3.5 text-neutral-600" />
              </div>
              <div className="bg-neutral-100 rounded-2xl rounded-tl-sm px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex gap-2 items-end">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nachricht eingeben… (Enter zum Senden)"
              rows={1}
              className="flex-1 resize-none text-sm border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand max-h-32 overflow-y-auto"
              style={{ minHeight: "2.5rem" }}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || isLoading}
              className="w-9 h-9 bg-brand hover:bg-brand-hover disabled:bg-neutral-200 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-[10px] text-neutral-400 mt-1 text-center">
            KI kann Fehler machen. Für Rechtsberatung Anwalt konsultieren.
          </p>
        </div>
      </div>
    </>
  );
}
