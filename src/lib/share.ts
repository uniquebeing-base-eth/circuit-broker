// Mobile-friendly download helpers. Tries Web Share API first (best on iOS),
// then a Blob download, then opening the URL in a new tab as a last resort.
export async function downloadFile(url: string, filename: string, mime = "image/png") {
  // Path 1: Web Share API with files (best on iOS, modern Android).
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const blob = await res.blob();
    const file = new File([blob], filename, { type: blob.type || mime });
    const navAny = navigator as any;
    if (navAny.canShare && navAny.canShare({ files: [file] })) {
      try {
        await navAny.share({ files: [file], title: filename });
        return true;
      } catch (e: any) {
        // user dismissed share sheet: don't fall through to blob auto-download
        if (e?.name === "AbortError") return true;
      }
    }
    // Path 2: classic blob download (works on desktop + most Android).
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl; a.download = filename; a.rel = "noopener";
    a.target = "_blank"; // iOS Safari needs this so the browser opens an image it can save via long-press
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
    return true;
  } catch {
    // Path 3: open original URL — user can long-press to save on mobile.
    window.open(url, "_blank", "noopener");
    return false;
  }
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

export async function shareText(text: string, title = "Shared from Circuit") {
  const navAny = navigator as any;
  if (navAny.share) {
    try { await navAny.share({ text, title }); return true; } catch {}
  }
  return copyText(text);
}
