const KEY = "mashinchi:dismissed-trigger-ids";

export function getDismissedTriggerIds(): Set<string> {
  return readSet();
}

function readSet(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

export function isTriggerDismissed(id: string): boolean {
  return readSet().has(id);
}

export function dismissTriggerId(id: string): void {
  const s = readSet();
  s.add(id);
  localStorage.setItem(KEY, JSON.stringify([...s]));
}
