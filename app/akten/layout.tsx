"use client";

import { Suspense } from "react";

export default function AktenLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      {children}
    </Suspense>
  );
}
