"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { User } from "@/lib/storage/user-store";
import type { Tag, NamespaceConfig } from "@/lib/tags";

const ACTIVE_USER_KEY = "active-user-id";
const DEFAULT_USER_ID = "user-001";

interface UserContextValue {
  currentUser: User | null;
  allUsers: User[];
  allTags: Tag[];
  allNamespaces: NamespaceConfig[];
  setCurrentUser: (userId: string) => void;
  refreshUsers: () => void;
  refreshTags: () => Promise<void>;
  refreshNamespaces: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  currentUser: null,
  allUsers: [],
  allTags: [],
  allNamespaces: [],
  setCurrentUser: () => {},
  refreshUsers: () => {},
  refreshTags: async () => {},
  refreshNamespaces: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allNamespaces, setAllNamespaces] = useState<NamespaceConfig[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>(DEFAULT_USER_ID);

  const loadTags = useCallback(async () => {
    const tags = await fetch("/api/tags").then((r) => r.json()).catch(() => []);
    setAllTags(tags as Tag[]);
  }, []);

  const loadNamespaces = useCallback(async () => {
    const ns = await fetch("/api/namespaces").then((r) => r.json()).catch(() => []);
    setAllNamespaces(ns as NamespaceConfig[]);
  }, []);

  const loadData = useCallback(async () => {
    const [usersRes, tagsRes, nsRes] = await Promise.all([
      fetch("/api/users").then((r) => r.json()).catch(() => []),
      fetch("/api/tags").then((r) => r.json()).catch(() => []),
      fetch("/api/namespaces").then((r) => r.json()).catch(() => []),
    ]);
    setAllUsers(usersRes as User[]);
    setAllTags(tagsRes as Tag[]);
    setAllNamespaces(nsRes as NamespaceConfig[]);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(ACTIVE_USER_KEY);
    if (stored) setActiveUserId(stored);
    loadData();
  }, [loadData]);

  const setCurrentUser = useCallback((userId: string) => {
    setActiveUserId(userId);
    localStorage.setItem(ACTIVE_USER_KEY, userId);
  }, []);

  const currentUser = allUsers.find((u) => u.id === activeUserId) ?? allUsers[0] ?? null;

  return (
    <UserContext.Provider value={{ currentUser, allUsers, allTags, allNamespaces, setCurrentUser, refreshUsers: loadData, refreshTags: loadTags, refreshNamespaces: loadNamespaces }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
