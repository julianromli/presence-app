'use client';

import { FormEvent, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ScanPage() {
  const [token, setToken] = useState('');
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult('');

    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    setResult(data.message ?? `${data.status ?? 'unknown'} - ${data.dateKey ?? '-'}`);
    setLoading(false);
  };

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold">Simulasi Scan Karyawan</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Tempel token QR aktif lalu kirim untuk proses check-in/check-out.
      </p>

      <form onSubmit={onSubmit} className="mt-6 max-w-xl space-y-3">
        <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token QR" required />
        <Button type="submit" disabled={loading || !token}>
          {loading ? 'Memproses...' : 'Scan Sekarang'}
        </Button>
      </form>

      {result ? <p className="mt-4 text-sm">Hasil: {result}</p> : null}
    </div>
  );
}
