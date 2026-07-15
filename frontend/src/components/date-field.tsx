"use client";

import { Calendar } from "lucide-react";
import { useRef } from "react";

const displayFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function DateField({
  value,
  onChange,
  placeholder = "Tarih seç",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const display = value
    ? displayFormatter.format(new Date(`${value}T00:00:00`))
    : placeholder;

  return (
    <button
      type="button"
      onClick={() => {
        const el = inputRef.current;
        if (!el) return;
        const showPicker = (el as HTMLInputElement & { showPicker?: () => void })
          .showPicker;
        if (showPicker) {
          showPicker.call(el);
        } else {
          el.focus();
        }
      }}
      className={`relative flex items-center gap-1.5 rounded-lg border p-2 text-left text-sm shadow-sm transition-colors hover:border-gray-400 ${className}`}
    >
      <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
      <span className={value ? "text-gray-900" : "text-gray-400"}>{display}</span>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        tabIndex={-1}
      />
    </button>
  );
}
