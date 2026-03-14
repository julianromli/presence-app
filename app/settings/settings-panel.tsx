'use client';

import { FormEvent, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { workspaceFetch } from '@/lib/workspace-client';

type SettingsPayload = {
  timezone: string;
  geofenceEnabled: boolean;
  geofenceRadiusMeters: number;
  scanCooldownSeconds: number;
  minLocationAccuracyMeters: number;
  enforceDeviceHeartbeat: boolean;
  geofenceLat?: number;
  geofenceLng?: number;
  whitelistEnabled: boolean;
  whitelistIps: string[];
};

export function SettingsPanel() {
  const [data, setData] = useState<SettingsPayload>({
    timezone: 'Asia/Jakarta',
    geofenceEnabled: false,
    geofenceRadiusMeters: 100,
    scanCooldownSeconds: 30,
    minLocationAccuracyMeters: 100,
    enforceDeviceHeartbeat: false,
    geofenceLat: undefined,
    geofenceLng: undefined,
    whitelistEnabled: false,
    whitelistIps: [],
  });
  const [ipText, setIpText] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const res = await workspaceFetch('/api/admin/settings', { cache: 'no-store' });
      if (!res.ok) return;
      const payload = await res.json();
      setData({
        timezone: payload.timezone,
        geofenceEnabled: payload.geofenceEnabled,
        geofenceRadiusMeters: payload.geofenceRadiusMeters,
        scanCooldownSeconds: payload.scanCooldownSeconds ?? 30,
        minLocationAccuracyMeters: payload.minLocationAccuracyMeters ?? 100,
        enforceDeviceHeartbeat: payload.enforceDeviceHeartbeat ?? false,
        geofenceLat: payload.geofenceLat,
        geofenceLng: payload.geofenceLng,
        whitelistEnabled: payload.whitelistEnabled,
        whitelistIps: payload.whitelistIps,
      });
      setIpText((payload.whitelistIps ?? []).join(', '));
    };

    void load();
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const whitelistIps = ipText
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean);

      const res = await workspaceFetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, whitelistIps }),
      });

      setMessage(res.ok ? 'Pengaturan berhasil disimpan.' : 'Gagal menyimpan pengaturan.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="mt-6 max-w-2xl space-y-4 rounded-2xl border p-6">
      <div>
        <label className="mb-1 block text-sm font-medium">Timezone</label>
        <Input
          value={data.timezone}
          onChange={(e) => setData((prev) => ({ ...prev, timezone: e.target.value }))}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.geofenceEnabled}
            onChange={(e) =>
              setData((prev) => ({ ...prev, geofenceEnabled: e.target.checked }))
            }
          />
          Aktifkan Geofence
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.whitelistEnabled}
            onChange={(e) =>
              setData((prev) => ({ ...prev, whitelistEnabled: e.target.checked }))
            }
          />
          Aktifkan IP Whitelist
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Radius (meter)</label>
          <Input
            type="number"
            value={data.geofenceRadiusMeters}
            onChange={(e) =>
              setData((prev) => ({ ...prev, geofenceRadiusMeters: Number(e.target.value) }))
            }
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Cooldown Scan (detik)</label>
          <Input
            type="number"
            value={data.scanCooldownSeconds}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                scanCooldownSeconds: Number(e.target.value),
              }))
            }
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Akurasi GPS Min (meter)</label>
          <Input
            type="number"
            value={data.minLocationAccuracyMeters}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                minLocationAccuracyMeters: Number(e.target.value),
              }))
            }
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Latitude</label>
          <Input
            type="number"
            value={data.geofenceLat ?? ''}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                geofenceLat: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Longitude</label>
          <Input
            type="number"
            value={data.geofenceLng ?? ''}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                geofenceLng: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={data.enforceDeviceHeartbeat}
          onChange={(e) =>
            setData((prev) => ({
              ...prev,
              enforceDeviceHeartbeat: e.target.checked,
            }))
          }
        />
        Wajibkan heartbeat device-qr
      </label>

      <div>
        <label className="mb-1 block text-sm font-medium">Whitelist IP (pisahkan koma)</label>
        <Input value={ipText} onChange={(e) => setIpText(e.target.value)} />
      </div>

      <Button type="submit" isLoading={saving} loadingText="Menyimpan...">
        Simpan Settings
      </Button>
      {message ? <p className="text-sm">{message}</p> : null}
    </form>
  );
}
