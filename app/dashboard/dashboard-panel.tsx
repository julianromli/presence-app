'use client';

import { FormEvent, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AttendanceRow = {
  _id: string;
  employeeName: string;
  dateKey: string;
  checkInAt?: number;
  checkOutAt?: number;
  edited: boolean;
};

function todayDateKey() {
  return new Date().toISOString().slice(0, 10);
}

export function DashboardPanel() {
  const [dateKey, setDateKey] = useState(() => todayDateKey());
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [message, setMessage] = useState('');
  const [reason, setReason] = useState('Koreksi admin');
  const [reportStatus, setReportStatus] = useState('');

  const stats = useMemo(() => {
    const total = rows.length;
    const checkedIn = rows.filter((r) => r.checkInAt).length;
    const checkedOut = rows.filter((r) => r.checkOutAt).length;
    const edited = rows.filter((r) => r.edited).length;

    return { total, checkedIn, checkedOut, edited };
  }, [rows]);

  const loadAttendance = async () => {
    const res = await fetch(`/api/admin/attendance?dateKey=${encodeURIComponent(dateKey)}`, {
      cache: 'no-store',
    });

    if (!res.ok) {
      setMessage('Gagal memuat data absensi.');
      return;
    }

    const data = await res.json();
    setRows(data);
    setMessage(`Data ${dateKey} dimuat (${data.length} baris).`);
  };

  const triggerWeeklyReport = async () => {
    setReportStatus('Memproses report...');
    const res = await fetch('/api/admin/reports', { method: 'POST' });
    const data = await res.json();
    setReportStatus(`Report ${data.weekKey ?? '-'} status: ${data.status ?? 'unknown'}`);
  };

  const editRow = async (attendanceId: string) => {
    const res = await fetch('/api/admin/attendance/edit', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceId, reason }),
    });

    if (res.ok) {
      setMessage('Edit attendance tersimpan dan masuk audit log.');
      await loadAttendance();
      return;
    }

    setMessage('Edit attendance gagal.');
  };

  const submitDate = async (e: FormEvent) => {
    e.preventDefault();
    await loadAttendance();
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">Total Data</p>
          <p className="mt-2 text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">Check-In</p>
          <p className="mt-2 text-2xl font-bold">{stats.checkedIn}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">Check-Out</p>
          <p className="mt-2 text-2xl font-bold">{stats.checkedOut}</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-muted-foreground text-xs">Edited</p>
          <p className="mt-2 text-2xl font-bold">{stats.edited}</p>
        </div>
      </section>

      <section className="rounded-xl border p-4">
        <form onSubmit={submitDate} className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Tanggal (dateKey)</label>
            <Input value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
          </div>
          <Button type="submit">Muat Data</Button>
        </form>

        <div className="mt-4 flex flex-wrap gap-3">
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Alasan edit"
            className="max-w-md"
          />
          <Button variant="outline" type="button" onClick={triggerWeeklyReport}>
            Generate Report Mingguan
          </Button>
        </div>

        {reportStatus ? <p className="mt-3 text-sm">{reportStatus}</p> : null}
        {message ? <p className="mt-2 text-sm">{message}</p> : null}
      </section>

      <section className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left">Nama Karyawan</th>
              <th className="p-3 text-left">Tanggal</th>
              <th className="p-3 text-left">Jam Datang</th>
              <th className="p-3 text-left">Jam Pulang</th>
              <th className="p-3 text-left">Edited</th>
              <th className="p-3 text-left">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row._id} className="border-t">
                <td className="p-3">{row.employeeName}</td>
                <td className="p-3">{row.dateKey}</td>
                <td className="p-3">{row.checkInAt ? new Date(row.checkInAt).toLocaleTimeString('id-ID') : '-'}</td>
                <td className="p-3">{row.checkOutAt ? new Date(row.checkOutAt).toLocaleTimeString('id-ID') : '-'}</td>
                <td className="p-3">{row.edited ? 'Ya' : 'Tidak'}</td>
                <td className="p-3">
                  <Button size="sm" variant="outline" onClick={() => editRow(row._id)}>
                    Tandai Edit
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={6}>
                  Belum ada data. Pilih tanggal lalu klik Muat Data.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
