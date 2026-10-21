// Uloženie / zdieľanie súborov a schránka.
// iOS (Safari aj PWA z plochy) vyžaduje, aby sa navigator.share zavolal priamo v ťuknutí — preto
// sa obsah pripraví vopred a shareFile() nečaká pred zdieľaním na nič asynchrónne.

/** Zdieľacie menu so súborom (iOS: Uložiť do Súborov, Claude, Mail…), inak stiahnutie. @returns 'shared'|'downloaded'|'cancelled' */
export function shareFile({ name, text, type = 'application/json' }) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    return navigator.share({ files: [file] }).then(
      () => 'shared',
      (err) => {
        if (err?.name === 'AbortError') return 'cancelled';
        download(file);
        return 'downloaded';
      },
    );
  }
  download(file);
  return Promise.resolve('downloaded');
}

function download(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Skopíruje text do schránky. @returns Promise<boolean> */
export function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(() => true, () => copyFallback(text));
  }
  return Promise.resolve(copyFallback(text));
}

function copyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

/** Načíta textový súbor vybraný používateľom. */
export function readFile(file) {
  if (file.text) return file.text();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}
