"use client";

import * as React from "react";
import { cn } from "./cn";

export type TabItem = { id: string; label: string };

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 border-b border-graphite/10", className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative px-4 py-2.5 text-sm font-medium transition-colors",
              isActive ? "text-orange" : "text-gray-neutral hover:text-graphite",
            )}
          >
            {tab.label}
            {isActive && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-orange" />
            )}
          </button>
        );
      })}
    </div>
  );
}
