'use client';

import { useState, useEffect } from 'react';
import { Settings, LogOut, ChevronRight, User as UserIcon, Loader2 } from 'lucide-react';
import { ScanBottomNav } from '@/components/ui/scan-bottom-nav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';

export function ProfilePanel() {
    const [loading, setLoading] = useState(true);
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    useEffect(() => {
        // Simulate network request for profile data
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1500);
        return () => clearTimeout(timer);
    }, []);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        // Simulate logout process
        await new Promise(resolve => setTimeout(resolve, 1000));
        setIsLoggingOut(false);
        setLogoutDialogOpen(false);
        // Usually you'd redirect here, e.g., window.location.href = '/login'
    };

    return (
        <div className="min-h-screen flex flex-col items-center bg-secondary/30 pb-20 justify-between">
            {/* Header */}
            <div className="w-full px-6 pt-6 pb-4 flex justify-between items-center bg-background border-b z-10 sticky top-0 md:max-w-md">
                <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">
                        Akun Anda
                    </p>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        Profil
                    </h1>
                </div>
                {loading ? (
                    <Skeleton className="w-10 h-10 rounded-full" />
                ) : (
                    <button className="relative w-10 h-10 rounded-full bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
                        <Settings className="w-5 h-5 text-foreground" />
                    </button>
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 w-full max-w-md px-6 py-6 mx-auto space-y-6">

                {/* User Card */}
                {loading ? (
                    <Card className="p-6 rounded-[24px] border-border shadow-sm flex flex-col items-center bg-card">
                        <Skeleton className="w-24 h-24 rounded-full mb-4" />
                        <Skeleton className="h-6 w-40 mb-2" />
                        <Skeleton className="h-4 w-32 mb-6" />

                        <div className="w-full grid grid-cols-2 gap-4">
                            <Skeleton className="h-20 w-full rounded-2xl" />
                            <Skeleton className="h-20 w-full rounded-2xl" />
                        </div>
                    </Card>
                ) : (
                    <Card className="p-6 rounded-[24px] border-border shadow-sm flex flex-col items-center bg-card">
                        <Avatar className="w-24 h-24 mb-4 border-4 border-background shadow-soft ring-2 ring-primary/20">
                            <AvatarImage src="/avatar-placeholder.png" alt="User" />
                            <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                                BU
                            </AvatarFallback>
                        </Avatar>
                        <h2 className="text-xl font-bold text-foreground">Budi Santoso</h2>
                        <p className="text-sm font-medium text-muted-foreground">Software Engineer</p>

                        <div className="w-full grid grid-cols-2 gap-4 mt-6">
                            <div className="bg-secondary/50 rounded-2xl p-4 text-center border border-border/50">
                                <p className="text-xs text-muted-foreground font-medium mb-1">Total Hadir</p>
                                <p className="text-xl font-bold text-foreground">24 <span className="text-xs font-normal">Hari</span></p>
                            </div>
                            <div className="bg-secondary/50 rounded-2xl p-4 text-center border border-border/50">
                                <p className="text-xs text-muted-foreground font-medium mb-1">Tepat Waktu</p>
                                <p className="text-xl font-bold text-success">98%</p>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Menu Items */}
                <div className="space-y-2">
                    {loading ? (
                        <>
                            <Skeleton className="h-20 w-full rounded-xl" />
                            <Skeleton className="h-20 w-full rounded-xl" />
                            <Skeleton className="h-16 w-full rounded-xl mt-4" />
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" className="w-full justify-between rounded-xl px-4 py-6 bg-card border border-border/50 hover:bg-secondary/50 h-auto">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <UserIcon className="w-5 h-5" />
                                    </div>
                                    <div className="text-left flex flex-col items-start gap-1">
                                        <span className="font-semibold text-foreground text-sm">Informasi Pribadi</span>
                                        <span className="text-xs text-muted-foreground">Ubah data diri & info kontak</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            </Button>

                            <Button variant="ghost" className="w-full justify-between rounded-xl px-4 py-6 bg-card border border-border/50 hover:bg-secondary/50 h-auto">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                        <Settings className="w-5 h-5" />
                                    </div>
                                    <div className="text-left flex flex-col items-start gap-1">
                                        <span className="font-semibold text-foreground text-sm">Pengaturan Presensi</span>
                                        <span className="text-xs text-muted-foreground">Notifikasi absensi</span>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            </Button>

                            <Button
                                variant="ghost"
                                className="w-full mt-4 justify-center rounded-xl px-4 py-6 bg-destructive/5 hover:bg-destructive/10 border border-destructive/20 h-auto"
                                onClick={() => setLogoutDialogOpen(true)}
                            >
                                <div className="flex items-center gap-2 text-destructive">
                                    <LogOut className="w-5 h-5" />
                                    <span className="font-bold text-sm">Keluar Akun</span>
                                </div>
                            </Button>
                        </>
                    )}
                </div>
            </div>

            <ScanBottomNav />

            {/* Logout Confirmation Dialog */}
            <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
                <DialogContent className="max-w-[340px] rounded-[24px] p-6 text-center">
                    <DialogHeader>
                        <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
                            <LogOut className="w-6 h-6 text-destructive" />
                        </div>
                        <DialogTitle className="text-xl font-bold text-foreground mx-auto text-center">Keluar Akun?</DialogTitle>
                        <DialogDescription className="text-center font-medium">
                            Anda harus melakukan login kembali untuk menggunakan aplikasi absensi.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-col sm:flex-col gap-2 mt-2">
                        <Button
                            variant="destructive"
                            className="w-full rounded-xl py-6 font-bold"
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                        >
                            {isLoggingOut ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Ya, Keluar Akun'}
                        </Button>
                        <DialogClose asChild>
                            <Button variant="ghost" className="w-full rounded-xl py-6 font-semibold" disabled={isLoggingOut}>
                                Batal
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
