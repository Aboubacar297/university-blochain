import { useEffect, useState } from 'react';
import { sha256Hex } from './hash';

/** Calcule l'empreinte SHA-256 du fichier sélectionné. */
export function useFileHash(file: File | null) {
  const [hash, setHash] = useState<string | null>(null);
  const [computing, setComputing] = useState(false);

  useEffect(() => {
    let alive = true;
    setHash(null);
    if (!file) return;
    setComputing(true);
    sha256Hex(file)
      .then((h) => alive && setHash(h))
      .catch(() => alive && setHash(null))
      .finally(() => alive && setComputing(false));
    return () => {
      alive = false;
    };
  }, [file]);

  return { hash, computing };
}
