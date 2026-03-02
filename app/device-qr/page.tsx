'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function DeviceQrPage() {
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    let active = true;

    const loadToken = async () => {
      const res = await fetch('/api/device/qr-token', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (!active) return;
      setToken(data.token);
      setExpiresAt(data.expiresAt);
    };

    void loadToken();
    const interval = setInterval(() => {
      void loadToken();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    }, 250);

    return () => clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    if (!token) return;

    void QRCode.toDataURL(token, {
      margin: 1,
      width: 512,
      color: {
        dark: '#0D0D12',
        light: '#FFFFFF',
      },
    }).then(setQrDataUrl);
  }, [token]);

  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-10">
      <div className="w-full max-w-xl rounded-3xl border bg-white p-8 text-center shadow-sm dark:bg-zinc-900">
        <p className="text-tagline text-xs font-semibold">MODE DEVICE-QR</p>
        <h1 className="mt-2 text-3xl font-bold">QR Absensi Dinamis</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Token otomatis refresh tiap 5 detik. Hanya scan token aktif yang akan diterima.
        </p>

        <div className="mx-auto mt-6 w-full max-w-sm rounded-2xl border bg-white p-4">
          {qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR Presence" className="aspect-square w-full" />
          ) : (
            <div className="grid aspect-square place-items-center text-sm text-zinc-500">Memuat QR...</div>
          )}
        </div>

        <p className="mt-4 text-sm font-medium">Berlaku: {secondsLeft} detik</p>
      </div>
    </div>
  );
}
