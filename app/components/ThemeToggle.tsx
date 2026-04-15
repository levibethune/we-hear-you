"use client";

import { useState, useEffect } from "react";

type Theme = "system" | "light" | "dark";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    const saved = localStorage.getItem("why-theme") as Theme | null;
    const initial = saved ?? "system";
    setTheme(initial);
    applyTheme(initial);

    // Listen for system theme changes
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if ((localStorage.getItem("why-theme") ?? "system") === "system") {
        applyTheme("system");
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  function cycle() {
    const order: Theme[] = ["system", "light", "dark"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    localStorage.setItem("why-theme", next);
    applyTheme(next);
  }

  const labels: Record<Theme, string> = {
    system: "System",
    light: "Light",
    dark: "Dark",
  };

  return (
    <button
      onClick={cycle}
      className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors px-3 py-2 rounded-xl hover:bg-card"
      title={`Theme: ${labels[theme]}`}
    >
      <span className="w-3.5 h-3.5 rounded-full border border-card-border overflow-hidden flex">
        <span className="w-1/2 bg-foreground" />
        <span className="w-1/2 bg-background" />
      </span>
      {labels[theme]}
    </button>
  );
}
