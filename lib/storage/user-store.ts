import fs from "fs/promises";
import path from "path";
import type { TagRef } from "@/lib/tags";

export interface UserFilterPreferences {
  /** Team sidebar tag filters */
  tags: TagRef[];
  /** Akten sidebar tag filters */
  aktenTags?: TagRef[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  initials: string;
  avatarUrl?: string;
  /** Required: at least one user/role/* TagRef */
  roles: TagRef[];
  /** Contextual tags: user/team/*, user/standort/*, user/hierarchie/*, etc. */
  tags: TagRef[];
  filterPreferences: UserFilterPreferences;
}

const USERS_DIR = path.join(process.cwd(), "data", "users");

export async function readUser(userId: string): Promise<User> {
  const file = path.join(USERS_DIR, `${userId}.json`);
  const raw = await fs.readFile(file, "utf-8");
  return JSON.parse(raw) as User;
}

export async function readAllUsers(): Promise<User[]> {
  const files = await fs.readdir(USERS_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
  const users = await Promise.all(
    jsonFiles.map(async (file) => {
      const raw = await fs.readFile(path.join(USERS_DIR, file), "utf-8");
      return JSON.parse(raw) as User;
    })
  );
  return users;
}

export async function writeUser(userId: string, user: User): Promise<void> {
  const file = path.join(USERS_DIR, `${userId}.json`);
  await fs.writeFile(file, JSON.stringify(user, null, 2), "utf-8");
}

export async function updateFilterPreferences(
  userId: string,
  prefs: Partial<UserFilterPreferences>
): Promise<User> {
  const user = await readUser(userId);
  const updated: User = { ...user, filterPreferences: { ...user.filterPreferences, ...prefs } };
  await writeUser(userId, updated);
  return updated;
}

/** Helper: extract role TagRefs from a user */
export function getUserRoles(user: User): TagRef[] {
  return user.roles.filter((r) => r.startsWith("user/role/"));
}

/** Helper: get all tags (roles + context tags) for display */
export function getAllUserTags(user: User): TagRef[] {
  return [...user.roles, ...user.tags];
}
