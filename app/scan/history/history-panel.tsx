'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell, MapPin, CalendarIcon, RefreshCw, AlertCircle, Loader2, Wifi, ChevronRight } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

import { ScanBottomNav } from '@/components/ui/scan-bottom-nav';
import { ScanNotificationsDrawer } from '@/components/ui/scan-notifications-drawer';
import { Card } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Sheet, SheetDescription, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type HistoryRecord = {
    id: number;
    type: 'check-in' | 'check-out';
    time: string;
    date: string;
    location: string;
    latLng: string;
    network: string;
    status: 'success' | 'late';
    photoUrl?: string;
};

export function HistoryPanel() {
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [date, setDate] = useState<Date | undefined>(new Date());
    const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const controls = useAnimation();

    // Simulated pull-to-refresh state
    const [startY, setStartY] = useState(0);
    const [pulling, setPulling] = useState(false);

    useEffect(() => {
        // Simulate initial network request
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    const handleRefresh = async () => {
        setIsRefreshing(true);
        setLoading(true);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setLoading(false);
        setIsRefreshing(false);
        controls.start({ y: -50, opacity: 0 }); // Reset spinner position
    };

    const dummyHistory: HistoryRecord[] = [
        {
            id: 1,
            type: 'check-in',
            time: '08:00 WIB',
            date: '12 Okt 2023',
            location: 'Kantor Pusat, Jakarta',
            latLng: '-6.200000, 106.816666',
            network: 'WIFI (Kantor)',
            status: 'success',
            photoUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=facearea&facepad=2&w=256&h=256&q=80',
        },
        {
            id: 2,
            type: 'check-out',
            time: '17:05 WIB',
            date: '12 Okt 2023',
            location: 'Kantor Pusat, Jakarta',
            latLng: '-6.200000, 106.816666',
            network: 'Cellular (4G)',
            status: 'success',
        },
        {
            id: 3,
            type: 'check-in',
            time: '08:15 WIB',
            date: '11 Okt 2023',
            location: 'Cabang Bandung',
            latLng: '-6.914744, 107.609810',
            network: 'WIFI (Public)',
            status: 'late',
        },
    ];

    // Dummy empty state condition
    const data = date && format(date, 'd') === '15' ? [] : dummyHistory;

    const openDetail = (item: HistoryRecord) => {
        setSelectedRecord(item);
        setDrawerOpen(true);
    };

    return (
        <div className="min-h-screen flex flex-col items-center bg-secondary/30 pb-20 justify-between overflow-hidden relative">
            <div
                className="fixed top-0 left-0 right-0 h-10 flex justify-center items-center z-0"
                style={{ pointerEvents: 'none' }}
            >
                <motion.div animate={controls} initial={{ y: -50, opacity: 0 }}>
                    <Loader2 className={cn("w-6 h-6 text-primary", isRefreshing ? "animate-spin" : "")} />
                </motion.div>
            </div>

            {/* Header */}
            <div className="w-full px-6 pt-6 pb-4 flex justify-between items-center bg-background border-b z-20 sticky top-0 md:max-w-md">
                <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                        Aktivitas Absensi
                    </p>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        Riwayat Scan
                    </h1>
                </div>
                <button
                    onClick={() => setNotifOpen(true)}
                    className="relative w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors group"
                >
                    <Bell className="w-5 h-5 text-foreground transition-transform group-active:scale-90" />
                    <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background ring-offset-0" />
                </button>
            </div>

            <ScanNotificationsDrawer open={notifOpen} onOpenChange={setNotifOpen} />

            {/* Main Content Area */}
            <div
                ref={containerRef}
                className="flex-1 w-full max-w-md px-6 py-6 mx-auto bg-transparent z-10 touch-pan-y"
                onTouchStart={(e) => {
                    if (window.scrollY === 0) {
                        setStartY(e.touches[0].clientY);
                        setPulling(true);
                    }
                }}
                onTouchMove={(e) => {
                    if (!pulling || isRefreshing) return;
                    const currentY = e.touches[0].clientY;
                    const diff = currentY - startY;
                    if (diff > 0 && diff < 150) {
                        controls.set({ y: diff * 0.5 - 50, opacity: diff / 150 });
                    } else if (diff >= 150 && !isRefreshing) {
                        handleRefresh();
                    }
                }}
                onTouchEnd={() => {
                    setPulling(false);
                    if (!isRefreshing) {
                        controls.start({ y: -50, opacity: 0 });
                    }
                }}
            >
                <div className="mb-6 flex space-x-2">
                    <Popover>
                        <PopoverTrigger
                            className={cn(
                                buttonVariants({ variant: "outline" }),
                                "flex-1 justify-start text-left font-medium rounded-full bg-background border-border/50",
                                !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP", { locale: id }) : <span>Pilih Tanggal</span>}
                        </PopoverTrigger>
                        <PopoverPopup className="w-auto p-0 rounded-[20px] shadow-xl" align="start">
                            <Calendar
                                mode="single"
                                selected={date}
                                onSelect={setDate}
                                initialFocus
                                className="p-3"
                            />
                        </PopoverPopup>
                    </Popover>

                    <Button variant="outline" size="icon" className="rounded-full bg-background border-border/50" onClick={handleRefresh}>
                        <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                    </Button>
                </div>

                <div className="space-y-4">
                    {loading ? (
                        [1, 2, 3].map((i) => (
                            <Card key={i} className="p-4 rounded-2xl border-border/50 shadow-sm flex items-center justify-between opacity-80">
                                <div className="flex items-center gap-4">
                                    <Skeleton className="w-12 h-12 rounded-full" />
                                    <div className="space-y-2">
                                        <Skeleton className="h-5 w-24" />
                                        <Skeleton className="h-3 w-32" />
                                    </div>
                                </div>
                                <div className="space-y-2 flex flex-col items-end">
                                    <Skeleton className="h-4 w-16" />
                                    <Skeleton className="h-5 w-20 rounded-full" />
                                </div>
                            </Card>
                        ))
                    ) : data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-70">
                            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4 border border-border">
                                <AlertCircle className="w-10 h-10 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-bold text-foreground">Riwayat Kosong</h3>
                            <p className="text-sm text-muted-foreground mt-2 max-w-[200px]">
                                Belum ada data scan absensi untuk filter yang Anda pilih.
                            </p>
                        </div>
                    ) : (
                        data.map((item) => (
                            <Card
                                key={item.id}
                                className="p-4 rounded-2xl border-border/50 shadow-sm flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all hover:bg-secondary/20"
                                onClick={() => openDetail(item)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center",
                                        item.type === 'check-in' ? 'bg-primary/10 text-foreground' : 'bg-orange-500/10 text-orange-500'
                                    )}>
                                        <span className="font-bold text-sm">
                                            {item.type === 'check-in' ? 'IN' : 'OUT'}
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-foreground">{item.time}</h3>
                                        <div className="flex items-center text-[11px] text-muted-foreground mt-1 max-w-[120px] sm:max-w-full truncate">
                                            <MapPin className="w-3 h-3 mr-1 flex-shrink-0" />
                                            <span className="truncate">{item.location}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-medium text-foreground">{item.date}</p>
                                    <span className={cn(
                                        "text-[10px] font-bold uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full inline-block",
                                        item.status === 'success' ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
                                    )}>
                                        {item.status === 'success' ? 'Tepat Waktu' : 'Terlambat'}
                                    </span>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            <ScanBottomNav />

            {/* Sheet Detail */}
            <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
                <SheetPopup className="bg-background border-border max-w-md mx-auto">
                    <SheetHeader className="text-left border-b border-border/50 pb-4">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "w-14 h-14 rounded-full flex items-center justify-center",
                                selectedRecord?.type === 'check-in' ? 'bg-primary/10 text-foreground' : 'bg-orange-500/10 text-orange-500'
                            )}>
                                <span className="font-bold text-lg">
                                    {selectedRecord?.type === 'check-in' ? 'IN' : 'OUT'}
                                </span>
                            </div>
                            <div>
                                <SheetTitle className="text-2xl font-bold">
                                    {selectedRecord?.time}
                                </SheetTitle>
                                <SheetDescription className="text-muted-foreground mt-0.5 font-medium">
                                    {selectedRecord?.date}
                                </SheetDescription>
                            </div>
                            <span className={cn(
                                "ml-auto text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full",
                                selectedRecord?.status === 'success' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                            )}>
                                {selectedRecord?.status === 'success' ? 'Tepat Waktu' : 'Terlambat'}
                            </span>
                        </div>
                    </SheetHeader>

                    <SheetPanel className="p-6 space-y-6">
                        <div className="w-full bg-secondary/50 rounded-[20px] aspect-video border border-border/50 overflow-hidden relative flex flex-col items-center justify-center">
                            <MapPin className="w-8 h-8 text-muted-foreground opacity-50 mb-2" />
                            <p className="text-xs text-muted-foreground font-medium">Data Peta Tersedia ({selectedRecord?.latLng})</p>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-blue-500 border-2 border-background shadow-lg animate-pulse" />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-blue-500/20 animate-ping" />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-secondary/30 rounded-2xl p-4 border border-border/50">
                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                    <MapPin className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-wide">Lokasi</span>
                                </div>
                                <p className="text-sm font-semibold text-foreground">{selectedRecord?.location}</p>
                            </div>
                            <div className="bg-secondary/30 rounded-2xl p-4 border border-border/50">
                                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                                    <Wifi className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-wide">Jaringan</span>
                                </div>
                                <p className="text-sm font-semibold text-foreground">{selectedRecord?.network}</p>
                            </div>
                        </div>

                        {selectedRecord?.photoUrl && (
                            <div className="flex items-center gap-4 bg-secondary/30 p-3 rounded-2xl border border-border/50">
                                <img src={selectedRecord.photoUrl} alt="Bukti Absen" className="w-12 h-12 rounded-xl object-cover" />
                                <div>
                                    <p className="text-sm font-semibold text-foreground">Bukti Swafoto Tersimpan</p>
                                    <p className="text-xs text-muted-foreground">Diunggah pada {selectedRecord?.time}</p>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground ml-auto" />
                            </div>
                        )}
                        <div className="p-4 pt-0">
                        <Button className="w-full rounded-2xl py-6 font-semibold shadow-md" onClick={() => setDrawerOpen(false)}>
                            Tutup Detail
                        </Button>
                        </div>
                    </SheetPanel>
                </SheetPopup>
            </Sheet>
        </div>
    );
}
