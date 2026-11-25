'use client';
import { useEffect } from 'react';
// Re-checks the payment every few seconds while the bank is still confirming.
export default function AutoRefresh({ seconds = 6, times = 10 }: { seconds?: number; times?: number }) {
  useEffect(() => {
    const k = 'loft_refresh', n = Number(sessionStorage.getItem(k) || 0);
    if (n >= times) return;
    const t = setTimeout(() => { sessionStorage.setItem(k, String(n + 1)); location.reload(); }, seconds * 1000);
    return () => clearTimeout(t);
  }, [seconds, times]);
  return null;
}
