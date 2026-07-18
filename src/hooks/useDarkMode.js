import { useState, useEffect } from "react";

export function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem("medconnect-theme") === "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    localStorage.setItem("medconnect-theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggle = () => setIsDark((prev) => !prev);

  return { isDark, toggle };
}
