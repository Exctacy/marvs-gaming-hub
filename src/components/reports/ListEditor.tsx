"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ListEditorProps {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export default function ListEditor({
  items,
  onChange,
  placeholder = "Add item…",
  disabled = false,
}: ListEditorProps) {
  const [draft, setDraft] = useState("");
  const visibleItems = items.filter((item) => item.trim());

  const add = () => {
    const value = draft.trim();
    if (!value) return;

    // Avoid duplicate entries while keeping the configured value's casing.
    if (items.some((item) => item.trim().toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }

    onChange([...items.filter((item) => item.trim()), value]);
    setDraft("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      add();
    }
  };

  const remove = (index: number) => {
    if (disabled) return;
    onChange(items.filter((_, itemIndex) => itemIndex !== index));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {items.map((item, index) => {
        if (!item.trim()) return null;
        return (
          <button
            key={`${item}-${index}`}
            type="button"
            disabled={disabled}
            title={disabled ? item : "Click to remove"}
            aria-label={disabled ? item : `Remove ${item}`}
            onClick={() => remove(index)}
            className="inline-flex max-w-full items-center rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-default disabled:border-border disabled:bg-muted disabled:text-muted-foreground"
          >
            <span className="truncate">{item}</span>
          </button>
        );
      })}

      {!disabled && (
        <div className="flex min-w-[220px] flex-1 items-center gap-1.5 basis-[220px] max-w-sm">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="h-8 min-w-0 flex-1 text-sm"
            aria-label={placeholder}
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-blue-200 px-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
      )}

      {visibleItems.length === 0 && disabled && (
        <p className="text-xs text-muted-foreground">No items yet.</p>
      )}
    </div>
  );
}
