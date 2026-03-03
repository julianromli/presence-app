'use client';

import { useEffect, useState } from 'react';

export function DeviceQrPanel() {
  const [token, setToken] = useState('');
  const [expiresAt, setExpiresAt] = useState(0);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [heartbeat, setHeartbeat] = useState<'idle' | 'ok' | 'error'>('idle');
  const [showToken, setShowToken] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

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
    setCopyState('idle');
  }, [token]);

  useEffect(() => {
    let mounted = true;
    const sendHeartbeat = async () => {
      const res = await fetch('/api/device/ping', { method: 'POST' });
      if (!mounted) return;
      setHeartbeat(res.ok ? 'ok' : 'error');
    };

    void sendHeartbeat();
    const interval = setInterval(() => {
      void sendHeartbeat();
    }, 15000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    const createQr = async () => {
      const QRCode = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(token, {
        margin: 1,
        width: 512,
        color: {
          dark: '#0D0D12',
          light: '#FFFFFF',
        },
      });
      setQrDataUrl(dataUrl);
    };

    void createQr();
  }, [token]);

  return (
    <div className="container flex min-h-[80vh] items-center justify-center py-10">
      <div className="w-full max-w-xl rounded-3xl border bg-white p-8 text-center shadow-sm dark:bg-zinc-900">
        <p className="text-tagline text-xs font-semibold">MODE DEVICE-QR</p>
        <h1 className="mt-2 text-3xl font-bold">QR Absensi Dinamis</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Token refresh tiap 5 detik dengan masa berlaku 20 detik. Hanya scan token aktif yang diterima.
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
        <p className="mt-2 text-xs text-zinc-500">
          Heartbeat device: {heartbeat === 'ok' ? 'online' : heartbeat === 'error' ? 'offline' : '...'}
        </p>

        <div className="mt-6 rounded-xl border bg-zinc-50 p-4 text-left dark:bg-zinc-800/40">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-1 text-xs font-medium"
              onClick={() => setShowToken((prev) => !prev)}
            >
              {showToken ? 'Sembunyikan Token' : 'Tampilkan Token (Fallback)'}
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-1 text-xs font-medium"
              disabled={!token}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(token);
                  setCopyState('copied');
                } catch {
                  setCopyState('failed');
                }
              }}
            >
              Copy Token
            </button>
            <span className="text-xs text-zinc-500">
              {copyState === 'copied'
                ? 'Token tersalin.'
                : copyState === 'failed'
                  ? 'Gagal copy, coba manual select.'
                  : ''}
            </span>
          </div>
          {showToken ? (
            <p className="mt-3 break-all rounded-md border bg-white p-2 font-mono text-[11px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
              {token || 'Memuat token...'}
            </p>
          ) : (
            <p className="mt-3 text-xs text-zinc-500">
              Gunakan hanya untuk fallback manual. Token berubah tiap 5 detik dan kedaluwarsa sekitar 20 detik.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
