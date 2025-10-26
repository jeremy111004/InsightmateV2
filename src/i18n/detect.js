// Priority: URL ?lng=fr > localStorage > browser language > default "fr"
export function detectLanguage() {
  const url = new URL(window.location.href);
  const urlLng = url.searchParams.get("lng");
  if (urlLng) return urlLng;

  const stored = localStorage.getItem("im.lang");
  if (stored) return stored;

  const nav = navigator.language || (navigator.languages && navigator.languages[0]);
  return (nav || "fr").slice(0, 2);
}
