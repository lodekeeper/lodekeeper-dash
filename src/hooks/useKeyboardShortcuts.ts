import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Global keyboard shortcuts:
 * g d → Dashboard
 * g t → Tasks
 * g r → Tracking
 * g a → Agents
 * g j → Jobs
 * g s → Stream
 * n   → New task (when on tasks page)
 */
export function useKeyboardShortcuts() {
  const navigate = useNavigate();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't trigger in inputs/textareas
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // g + key navigation
      if (e.key === "g") {
        const handler = (next: KeyboardEvent) => {
          window.removeEventListener("keydown", handler);
          switch (next.key) {
            case "d":
              navigate("/");
              break;
            case "t":
              navigate("/tasks");
              break;
            case "r":
              navigate("/tracking");
              break;
            case "a":
              navigate("/agents");
              break;
            case "j":
              navigate("/jobs");
              break;
            case "s":
              navigate("/stream");
              break;
          }
        };
        window.addEventListener("keydown", handler, { once: true });
        setTimeout(() => window.removeEventListener("keydown", handler), 500);
      }
    },
    [navigate],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
