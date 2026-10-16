"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function DocumentNoticeBadge() {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  useEffect(() => {
    const controller = new AbortController();
    const update = async () => {
      try {
        const res = await fetch("/api/documents/notifications", { cache: "no-store", signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json();
        if (!controller.signal.aborted) setCount(data.notices.length);
      } catch { /* The documents page reports connection errors. */ }
    };
    void update();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void update(); }, 60000);
    window.addEventListener("document-notices-changed", update);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("document-notices-changed", update); };
  }, [pathname]);
  return count ? <span aria-label={`${count} unread document notifications`} className="ml-auto rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold text-white">{count >= 50 ? "50+" : count}</span> : null;
}
