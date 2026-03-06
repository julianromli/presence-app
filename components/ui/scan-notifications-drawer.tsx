'use client';

import * as React from 'react';
import { Bell, Clock, Info, AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { Sheet, SheetClose, SheetDescription, SheetFooter, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type Notification = {
    id: string;
    title: string;
    description: string;
    time: string;
    type: 'system' | 'info' | 'warning' | 'success';
    read: boolean;
};

const mockNotifications: Notification[] = [
    {
        id: '1',
        title: 'Absensi Berhasil',
        description: 'Anda telah berhasil melakukan check-in pada pukul 08:00 WIB hari ini.',
        time: '5 menit yang lalu',
        type: 'success',
        read: false,
    },
    {
        id: '2',
        title: 'Pengingat Absen Pulang',
        description: 'Jangan lupa untuk melakukan scan pulang sebelum meninggalkan area kantor.',
        time: '2 jam yang lalu',
        type: 'warning',
        read: false,
    },
    {
        id: '3',
        title: 'Update Sistem',
        description: 'Aplikasi akan melakukan pemeliharaan pada hari Minggu pukul 00:00 WIB.',
        time: '12 jam yang lalu',
        type: 'info',
        read: true,
    },
    {
        id: '4',
        title: 'Verifikasi Lokasi',
        description: 'Lokasi scan Anda terdeteksi berada di radius gedung pusat.',
        time: 'Kemarin',
        type: 'system',
        read: true,
    },
];

interface ScanNotificationsDrawerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ScanNotificationsDrawer({ open, onOpenChange }: ScanNotificationsDrawerProps) {
    const [notifications, setNotifications] = React.useState<Notification[]>(mockNotifications);

    const unreadCount = notifications.filter(n => !n.read).length;

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const clearAll = () => {
        setNotifications([]);
    };

    const getTypeIcon = (type: Notification['type']) => {
        switch (type) {
            case 'success': return <CheckCircle2 className="w-5 h-5 text-success" />;
            case 'warning': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
            case 'info': return <Info className="w-5 h-5 text-blue-500" />;
            default: return <Clock className="w-5 h-5 text-muted-foreground" />;
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetPopup className="max-w-md mx-auto h-[85vh]">
                <SheetHeader className="border-b border-border/50 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <SheetTitle className="text-xl font-bold">Notifikasi</SheetTitle>
                            {unreadCount > 0 && (
                                <span className="bg-primary text-background text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {unreadCount} Baru
                                </span>
                            )}
                        </div>
                        {notifications.length > 0 && (
                            <Button variant="ghost" size="sm" className="text-xs font-semibold text-primary h-8 p-1" onClick={markAllAsRead}>
                                Baca Semua
                            </Button>
                        )}
                    </div>
                    <SheetDescription className="text-xs">
                        Informasi aktivitas dan berita terbaru untuk Anda.
                    </SheetDescription>
                </SheetHeader>

                <SheetPanel className="flex-1 overflow-y-auto p-4 space-y-3">
                    {notifications.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-center py-20 opacity-60">
                            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
                                <Bell className="w-10 h-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground">Tidak Ada Notifikasi</h3>
                            <p className="text-sm text-muted-foreground mt-2 max-w-[200px] mx-auto">
                                Semua beres! Belum ada kabar baru untuk saat ini.
                            </p>
                        </div>
                    ) : (
                        notifications.map((n) => (
                            <div
                                key={n.id}
                                className={cn(
                                    "relative p-4 rounded-2xl border transition-all flex gap-4 cursor-pointer active:scale-[0.98]",
                                    n.read ? "bg-background border-border/40 opacity-70" : "bg-primary/[0.03] border-primary/10 shadow-sm"
                                )}
                                onClick={() => markAsRead(n.id)}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                                    n.read ? "bg-secondary" : "bg-background shadow-xs border border-border/40"
                                )}>
                                    {getTypeIcon(n.type)}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <h4 className={cn("text-sm font-bold", n.read ? "text-muted-foreground" : "text-foreground")}>
                                            {n.title}
                                        </h4>
                                        <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap ml-2">
                                            {n.time}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        {n.description}
                                    </p>
                                </div>
                                {!n.read && (
                                    <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary animate-pulse" />
                                )}
                            </div>
                        ))
                    )}
                </SheetPanel>

                <SheetFooter className="border-t border-border/40 p-4">
                    <div className="flex gap-2 w-full">
                        <Button variant="outline" className="flex-1 rounded-xl h-12 font-semibold" onClick={clearAll}>
                            <Trash2 className="w-4 h-4 mr-2" /> Hapus Semua
                        </Button>
                        <SheetClose render={<Button className="flex-1 rounded-xl h-12 font-bold shadow-lg shadow-primary/20" />}>
                            Tutup
                        </SheetClose>
                    </div>
                </SheetFooter>
            </SheetPopup>
        </Sheet>
    );
}
