import { toDataURL } from 'qrcode';
import { useEffect, useState } from 'react';

/** QR code généré dans le navigateur (aucune donnée envoyée à un service tiers). */
export function QrCode({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState<string>();

  useEffect(() => {
    let alive = true;
    toDataURL(value, { margin: 1, width: 272, errorCorrectionLevel: 'M', color: { dark: '#0D1110', light: '#FFFFFF' } })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(undefined));
    return () => {
      alive = false;
    };
  }, [value]);

  if (!src) return null;
  return (
    <span className="qr">
      <img src={src} alt={label} width={136} height={136} loading="lazy" decoding="async" />
    </span>
  );
}
