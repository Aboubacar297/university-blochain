/** Empreinte SHA-256 (hexadécimal) calculée dans le navigateur : le fichier ne quitte pas l'appareil pour ce calcul. */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Contrôle de la signature magique d'un PDF ("%PDF-"). */
export async function looksLikePdf(blob: Blob): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
  return String.fromCharCode(...head) === '%PDF-';
}
