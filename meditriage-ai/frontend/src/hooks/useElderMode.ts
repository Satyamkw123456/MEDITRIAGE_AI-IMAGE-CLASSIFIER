"use client";

import { useState, useEffect, useCallback } from "react";

export function useElderMode() {
  const [elderMode, setElderMode] = useState<boolean>(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("meditriage_elder_mode") : null;
    if (saved === "true") {
      setElderMode(true);
      document.documentElement.setAttribute("data-elder", "true");
      document.documentElement.classList.add("elder-mode");
    } else {
      document.documentElement.setAttribute("data-elder", "false");
      document.documentElement.classList.remove("elder-mode");
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === "meditriage_elder_mode") {
        const isElder = e.newValue === "true";
        setElderMode(isElder);
        document.documentElement.setAttribute("data-elder", isElder ? "true" : "false");
        if (isElder) {
          document.documentElement.classList.add("elder-mode");
        } else {
          document.documentElement.classList.remove("elder-mode");
        }
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggleElderMode = useCallback(() => {
    setElderMode((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("meditriage_elder_mode", String(next));
        document.documentElement.setAttribute("data-elder", next ? "true" : "false");
        if (next) {
          document.documentElement.classList.add("elder-mode");
        } else {
          document.documentElement.classList.remove("elder-mode");
        }
      }
      return next;
    });
  }, []);

  return { elderMode, toggleElderMode };
}
