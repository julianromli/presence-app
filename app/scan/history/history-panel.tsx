'use client';

import { Bell, MapPin } from 'lucide-react';
import { ScanBottomNav } from '@/components/ui/scan-bottom-nav';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function HistoryPanel() {
    const dummyHistory = [
        {
            id: 1,
            type: 'check-in',
            time: '08:00 WIB',
            date: '12 Okt 2023',
            location: 'Kantor Pusat, Jakarta',
            status: 'success',
        },
        {
            id: 2,
            type: 'check-out',
            time: '17:05 WIB',
            date: '12 Okt 2023',
            location: 'Kantor Pusat, Jakarta',
            status: 'success',
        },
        {
            id: 3,
            type: 'check-in',
            time: '08:15 WIB',
            date: '11 Okt 2023',
            location: 'Cabang Bandung',
            status: 'late',
        },
        {
            id: 4,
            type: 'check-out',
            time: '17:00 WIB',
            date: '11 Okt 2023',
            location: 'Cabang Bandung',
            status: 'success',
        },
    ];

    return (
        <div className="min-h-screen flex flex-col items-center bg-secondary/30 pb-20 justify-between">
            {/* Header */}
            <div className="w-full px-6 pt-6 pb-4 flex justify-between items-center bg-background border-b z-10 sticky top-0 md:max-w-md">
                <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                        Aktivitas Absensi
                    </p>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        Riwayat Scan
                    </h1>
                </div>
                <button className="relative w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                    <Bell className="w-5 h-5 text-foreground" />
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 w-full max-w-md px-6 py-6 mx-auto">
                <div className="mb-6 flex space-x-2">
                    <Button variant="outline" size="sm" className="rounded-full bg-foreground text-background hover:bg-foreground/90 hover:text-background">
                        Semua
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-full bg-background">
                        Minggu Ini
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-full bg-background">
                        Bulan Ini
                    </Button>
                </div>

                <div className="space-y-4">
                    {dummyHistory.map((item) => (
                        <Card key={item.id} className="p-4 rounded-2xl border-border/50 shadow-sm flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${item.type === 'check-in' ? 'bg-primary/10 text-primary' : 'bg-orange-500/10 text-orange-500'}`}>
                                    <span className="font-bold text-sm">
                                        {item.type === 'check-in' ? 'IN' : 'OUT'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="font-semibold text-foreground">{item.time}</h3>
                                    <div className="flex items-center text-xs text-muted-foreground mt-1">
                                        <MapPin className="w-3 h-3 mr-1" />
                                        {item.location}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-medium text-foreground">{item.date}</p>
                                <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full inline-block ${item.status === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>
                                    {item.status === 'success' ? 'Tepat Waktu' : 'Terlambat'}
                                </span>
                            </div>
                        </Card>
                    ))}
                </div>

                <div className="mt-8 text-center">
                    <Button variant="ghost" className="text-muted-foreground text-sm font-medium">
                        Muat Lebih Banyak
                    </Button>
                </div>
            </div>

            <ScanBottomNav />
        </div>
    );
}
