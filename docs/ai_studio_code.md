Saya ingin merombak UI dashboard di project ini agar menggunakan desain baru yang lebih modern dan modular. Untuk function dan copynya disesuaikan dengan semua integrasi yang ada di project ini.

Berikut adalah langkah-langkah yang harus kamu lakukan:

1. Buat folder `components/dashboard/` di dalam project ini.
2. Buat 4 file komponen UI berikut di dalam folder tersebut menggunakan kode yang saya sediakan di bawah:
   - `layout.tsx` (Kerangka utama)
   - `header.tsx` (Top Navigation)
   - `sidebar.tsx` (Navigasi Kiri)
   - `page-header.tsx` (Header untuk konten halaman)
3. Pastikan project ini sudah menginstall `lucide-react` untuk icon. Jika belum, tolong install. (Khusus project ini, sesuaikan dengan Phosphor Icons saja)
4. Refactor halaman utama dashboard (misalnya `app/page.tsx` atau `app/dashboard/page.tsx`) agar dibungkus menggunakan `<DashboardLayout>` dan menggunakan `<DashboardPageHeader>` untuk judul halamannya.
5. Sesuaikan konten yang sudah ada di halaman tersebut agar masuk ke dalam area konten `<DashboardLayout>`.

Berikut adalah source code untuk komponen-komponennya:

--- File 1: components/dashboard/layout.tsx ---
import React from "react";
import { DashboardHeader } from "./header";
import { DashboardSidebar } from "./sidebar";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full flex-col bg-white overflow-hidden font-sans">
      <DashboardHeader />
      <div className="flex flex-1 overflow-hidden">
        <DashboardSidebar />
        <main className="flex flex-1 flex-col bg-[#fafafa]">
          {children}
        </main>
      </div>
    </div>
  );
}

--- File 2: components/dashboard/page-header.tsx ---
import React from "react";

interface DashboardPageHeaderProps {
  title: string;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onActionClick?: () => void;
}

export function DashboardPageHeader({
  title,
  actionLabel,
  actionIcon,
  onActionClick,
}: DashboardPageHeaderProps) {
  return (
    <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-zinc-200 px-8 bg-white">
      <h1 className="text-[18px] font-semibold text-zinc-900">{title}</h1>
      {actionLabel && (
        <button
          onClick={onActionClick}
          className="flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 transition-colors"
        >
          {actionIcon}
          {actionLabel}
        </button>
      )}
    </div>
  );
}

--- File 3: components/dashboard/header.tsx ---
import { Search, ChevronDown, PanelLeftClose } from "lucide-react";

export function DashboardHeader() {
  return (
    <header className="flex h-[52px] w-full shrink-0 items-center justify-between bg-[#18181b] px-4 text-white">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 cursor-pointer hover:opacity-80">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#6366f1] text-xs font-bold text-white">
            M
          </div>
          <span className="text-[14px] font-medium">AI Studio</span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
        </div>
        
        <div className="h-4 w-px bg-zinc-700 mx-1" />
        
        <button className="text-zinc-400 hover:text-zinc-300 transition-colors">
          <PanelLeftClose className="h-[18px] w-[18px]" />
        </button>
        
        <div className="ml-2 flex items-center gap-1 text-[13px]">
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-800 cursor-pointer transition-colors">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-600 text-[10px] font-medium text-white">
              F
            </div>
            <span className="text-zinc-200 font-medium">Faiz Intifada</span>
          </div>
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-zinc-800 cursor-pointer transition-colors">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-zinc-700 text-[10px] font-medium text-zinc-300">
              D
            </div>
            <span className="text-zinc-200 font-medium">Default Workspace</span>
            <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex h-8 w-64 items-center gap-2 rounded-md border border-zinc-700 bg-zinc-800/50 px-3 text-[13px] text-zinc-400 focus-within:border-zinc-500 focus-within:bg-zinc-800 transition-colors cursor-text">
          <Search className="h-4 w-4" />
          <span className="flex-1">Search</span>
          <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-500">
            <span>Ctrl+K</span>
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded bg-zinc-700 text-[11px] font-medium text-white cursor-pointer hover:bg-zinc-600 transition-colors">
          FI
        </div>
      </div>
    </header>
  );
}

--- File 4: components/dashboard/sidebar.tsx ---
import React from "react";
import {
  Home, Key, FlaskConical, Bot, Layers, FileText, Volume2, Wrench, FolderOpen, Terminal, Code2, HelpCircle,
} from "lucide-react";

function SidebarItem({ icon, label, active, badge }: { icon: React.ReactNode; label: string; active?: boolean; badge?: string; }) {
  return (
    <button className={`group flex w-full items-center justify-between rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${active ? "bg-[#e4e4e7] text-zinc-900" : "text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900"}`}>
      <div className="flex items-center gap-3">
        <div className={active ? "text-zinc-900" : "text-zinc-500 group-hover:text-zinc-700"}>{icon}</div>
        {label}
      </div>
      {badge && <span className="rounded bg-blue-100/80 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600">{badge}</span>}
    </button>
  );
}

export function DashboardSidebar() {
  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-zinc-200 bg-[#f4f4f5] py-4">
      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3">
        <div className="flex flex-col gap-0.5">
          <SidebarItem icon={<Home className="h-[18px] w-[18px]" />} label="Home" />
          <SidebarItem icon={<Key className="h-[18px] w-[18px]" />} label="API Keys" />
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="px-3 pb-2 pt-2 text-[12px] font-medium text-zinc-500">Create</div>
          <SidebarItem icon={<FlaskConical className="h-[18px] w-[18px]" />} label="Playground" />
          <SidebarItem icon={<Bot className="h-[18px] w-[18px]" />} label="Agents" />
          <SidebarItem icon={<Layers className="h-[18px] w-[18px]" />} label="Batches" />
          <SidebarItem icon={<FileText className="h-[18px] w-[18px]" />} label="Document AI" active />
          <SidebarItem icon={<Volume2 className="h-[18px] w-[18px]" />} label="Audio" />
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="px-3 pb-2 pt-2 text-[12px] font-medium text-zinc-500">Improve</div>
          <SidebarItem icon={<Wrench className="h-[18px] w-[18px]" />} label="Fine-tune" />
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="px-3 pb-2 pt-2 text-[12px] font-medium text-zinc-500">Context</div>
          <SidebarItem icon={<FolderOpen className="h-[18px] w-[18px]" />} label="Files" />
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="px-3 pb-2 pt-2 text-[12px] font-medium text-zinc-500">Code</div>
          <SidebarItem icon={<Terminal className="h-[18px] w-[18px]" />} label="Vibe CLI" badge="New" />
          <SidebarItem icon={<Code2 className="h-[18px] w-[18px]" />} label="Codestral" />
        </div>
      </nav>
      <div className="mt-auto px-3 pt-4">
        <SidebarItem icon={<HelpCircle className="h-[18px] w-[18px]" />} label="Help & Resources" />
      </div>
    </aside>
  );
}