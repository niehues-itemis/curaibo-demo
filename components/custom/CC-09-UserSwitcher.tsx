"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import Image from "next/image";
import { useUser } from "@/lib/user-context";
import { lookupTag, TAG_COLORS } from "@/lib/tags";
import type { User } from "@/lib/storage/user-store";

const ROLE_ORDER = ["user/role/kanzlei-partner", "user/role/rechtsanwalt", "user/role/refa", "user/role/administrator"];
const ROLE_LABELS: Record<string, string> = {
  "user/role/kanzlei-partner": "Kanzlei-Partner",
  "user/role/rechtsanwalt":    "Rechtsanwälte",
  "user/role/refa":            "ReFas",
  "user/role/administrator":   "Administration",
};

function RoleBadge({ roleRef, allTags }: { roleRef: string; allTags: ReturnType<typeof useUser>["allTags"] }) {
  const tag = lookupTag(allTags, roleRef);
  if (!tag) return null;
  const colors = TAG_COLORS[tag.color] ?? TAG_COLORS.gray;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colors.bg} ${colors.text}`}>
      {tag.label}
    </span>
  );
}

function UserAvatar({ user, size = "sm" }: { user: User; size?: "sm" | "md" }) {
  const px = size === "md" ? 32 : 28;
  const dim = size === "md" ? "h-8 w-8" : "h-7 w-7";
  if (user.avatarUrl) {
    return (
      <div className={`${dim} rounded-full overflow-hidden bg-neutral-100 flex-shrink-0`}>
        <Image src={user.avatarUrl} alt={user.name} width={px} height={px} className="object-cover w-full h-full" unoptimized />
      </div>
    );
  }
  const textSize = size === "md" ? "text-sm" : "text-xs";
  return (
    <div className={`${dim} rounded-full bg-brand-light text-brand-dark ${textSize} font-semibold flex items-center justify-center flex-shrink-0`}>
      {user.initials}
    </div>
  );
}

export function UserSwitcher() {
  const { currentUser, allUsers, allTags, setCurrentUser } = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!currentUser) return null;

  const primaryRole = currentUser.roles[0];

  // Group users by primary role
  const grouped = ROLE_ORDER.reduce<Record<string, User[]>>((acc, role) => {
    const members = allUsers.filter((u) => u.roles[0] === role);
    if (members.length > 0) acc[role] = members;
    return acc;
  }, {});

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
      >
        <UserAvatar user={currentUser} />
        <div className="hidden sm:flex flex-col items-start min-w-0">
          <span className="text-sm font-medium text-neutral-900 truncate max-w-[120px]">{currentUser.name}</span>
          {primaryRole && <RoleBadge roleRef={primaryRole} allTags={allTags} />}
        </div>
        <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white border border-neutral-200 rounded-xl shadow-lg z-50 py-2 overflow-hidden">
          {Object.entries(grouped).map(([role, users]) => (
            <div key={role}>
              <div className="px-3 py-1.5 text-xs font-semibold text-neutral-400 uppercase tracking-wide">
                {ROLE_LABELS[role] ?? role}
              </div>
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => { setCurrentUser(user.id); setOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-neutral-50 transition-colors text-left ${
                    user.id === currentUser.id ? "bg-brand-light/50" : ""
                  }`}
                >
                  <UserAvatar user={user} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-900 truncate">{user.name}</div>
                    <div className="text-xs text-neutral-400 truncate">{user.email}</div>
                  </div>
                  {user.id === currentUser.id && (
                    <Check className="h-4 w-4 text-brand flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
