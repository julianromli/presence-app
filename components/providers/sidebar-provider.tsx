'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type SidebarContextType = {
    isCollapsed: boolean;
    toggleSidebar: () => void;
    setCollapsed: (collapsed: boolean) => void;
};

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        const frame = window.requestAnimationFrame(() => {
            setIsCollapsed(localStorage.getItem('sidebar-collapsed') === 'true');
        });
        return () => window.cancelAnimationFrame(frame);
    }, []);

    const toggleSidebar = () => {
        setIsCollapsed((prev) => {
            const next = !prev;
            if (typeof window !== 'undefined') {
                localStorage.setItem('sidebar-collapsed', String(next));
            }
            return next;
        });
    };

    const setCollapsed = (collapsed: boolean) => {
        setIsCollapsed(collapsed);
        if (typeof window !== 'undefined') {
            localStorage.setItem('sidebar-collapsed', String(collapsed));
        }
    };

    return (
        <SidebarContext.Provider value={{ isCollapsed, toggleSidebar, setCollapsed }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (context === undefined) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
}
