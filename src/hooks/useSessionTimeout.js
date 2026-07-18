import { useState, useEffect, useCallback } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase";

const TIMEOUT_MS = 30 * 60 * 1000;

export function useSessionTimeout() {
  const [isExpired, setIsExpired] = useState(false);

 const resetTimer = useCallback(() => {
    if (window.__sessionTimer) clearTimeout(window.__sessionTimer);
    window.__sessionTimer = setTimeout(() => {
      signOut(auth);
      setIsExpired(true);
    }, TIMEOUT_MS);
  }, []);

  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart"];
    events.forEach((e) => document.addEventListener(e, resetTimer));

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) resetTimer();
    });

    resetTimer();

    return () => {
      events.forEach((e) => document.removeEventListener(e, resetTimer));
      if (window.__sessionTimer) clearTimeout(window.__sessionTimer);
      unsubscribe();
    };
  }, [resetTimer]);

  return isExpired;
}
