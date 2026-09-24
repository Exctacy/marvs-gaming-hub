"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const update = (i: number, val: string) => {
    const next = [...items];
    next[i] = val;
    onChange(next);
  };

  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));

  const add = () => onChange([...items, ""]);

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground">No items yet.</p>
      )}
      {items.map((item, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={item}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1"
          />
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-red-500 hover:text-red-700 shrink-0"
              onClick={() => remove(i)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ))}
      {!disabled && (
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      )}
    </div>
  );
}
