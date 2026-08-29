export function safeInternalPath(value: string | null | undefined, fallback = "/dashboard") {
  if (!value) return fallback;

  try {
    const base = new URL("https://agendafacil.local");
    const target = new URL(value, base);
    if (target.origin !== base.origin) return fallback;
    if (!target.pathname.startsWith("/")) return fallback;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return fallback;
  }
}
