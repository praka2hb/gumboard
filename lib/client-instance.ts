export function getClientInstanceId(): string | null {
  if (typeof window === "undefined") return null;
  const key = "gumboard-instance-id";
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      sessionStorage.setItem(key, id);
    } catch {
      // ignore storage failures
    }
  }
  return id;
}


