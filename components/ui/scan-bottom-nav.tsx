import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ScanLine, History, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ScanBottomNav() {
    const pathname = usePathname();

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-6 pb-6 pt-2 z-50 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)]">
            <div className="flex justify-around items-center max-w-md mx-auto">
                <Link href="/scan" className="flex flex-col items-center gap-1 p-2 w-16 group outline-none">
                    <div
                        className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center transition-all group-active:scale-95',
                            pathname === '/scan'
                                ? 'bg-foreground text-background shadow-lg shadow-foreground/20'
                                : 'text-muted-foreground hover:bg-secondary',
                        )}
                    >
                        <ScanLine className="w-5 h-5" />
                    </div>
                    <span
                        className={cn(
                            'text-[10px] mt-1 transition-colors',
                            pathname === '/scan'
                                ? 'font-bold text-foreground'
                                : 'font-medium text-muted-foreground',
                        )}
                    >
                        Scan
                    </span>
                </Link>
                <Link href="/scan/history" className="flex flex-col items-center gap-1 p-2 w-16 group outline-none">
                    <div
                        className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center transition-all group-active:scale-95',
                            pathname === '/scan/history'
                                ? 'bg-foreground text-background shadow-lg shadow-foreground/20'
                                : 'text-muted-foreground hover:bg-secondary',
                        )}
                    >
                        <History className="w-5 h-5" />
                    </div>
                    <span
                        className={cn(
                            'text-[10px] mt-1 transition-colors',
                            pathname === '/scan/history'
                                ? 'font-bold text-foreground'
                                : 'font-medium text-muted-foreground',
                        )}
                    >
                        Riwayat
                    </span>
                </Link>
                <Link href="/scan/profile" className="flex flex-col items-center gap-1 p-2 w-16 group outline-none">
                    <div
                        className={cn(
                            'w-10 h-10 rounded-xl flex items-center justify-center transition-all group-active:scale-95',
                            pathname === '/scan/profile'
                                ? 'bg-foreground text-background shadow-lg shadow-foreground/20'
                                : 'text-muted-foreground hover:bg-secondary',
                        )}
                    >
                        <User className="w-5 h-5" />
                    </div>
                    <span
                        className={cn(
                            'text-[10px] mt-1 transition-colors',
                            pathname === '/scan/profile'
                                ? 'font-bold text-foreground'
                                : 'font-medium text-muted-foreground',
                        )}
                    >
                        Profil
                    </span>
                </Link>
            </div>
        </div>
    );
}
