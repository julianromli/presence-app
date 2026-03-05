'use client';

import { UserButton } from '@clerk/nextjs';
import {
  CaretDown,
  MagnifyingGlass,
  SidebarSimple,
  CaretRight
} from '@phosphor-icons/react/dist/ssr';
import { useRouter } from 'next/navigation';

type DashboardHeaderProps = {
  role?: string;
  name?: string;
  email?: string;
};

export function DashboardHeader({ name = 'Faiz Intifada', email = 'faiz@example.com' }: DashboardHeaderProps) {
  const router = useRouter();

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 bg-[#141414] px-4 text-zinc-100">
      <div className="flex items-center gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded bg-gradient-to-br from-indigo-500 to-purple-600 text-[10px] font-bold text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 22V6C4 4.89543 4.89543 4 6 4H8C9.10457 4 10 4.89543 10 6V11L12 8L14 11V6C14 4.89543 14.89543 4 16 4H18C19.10457 4 20 4.89543 20 6V22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="text-sm font-semibold">AI Studio</span>
          <CaretDown weight="bold" className="h-3 w-3 text-zinc-400" />
        </div>

        <button className="flex h-8 w-8 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100">
          <SidebarSimple weight="regular" className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <div className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-800">
            <div className="grid h-5 w-5 place-items-center rounded-full bg-zinc-700 text-[10px] font-medium text-white">
              F
            </div>
            <span>Faiz Intifada</span>
          </div>
          
          <span className="text-zinc-600">/</span>
          
          <div className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-800 cursor-pointer">
            <div className="grid h-5 w-5 place-items-center rounded-full bg-zinc-700 text-[10px] font-medium text-white">
              D
            </div>
            <span>Default Workspace</span>
            <CaretDown weight="bold" className="ml-1 h-3 w-3 text-zinc-500" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex items-center">
          <MagnifyingGlass weight="bold" className="absolute left-3 h-4 w-4 text-zinc-400" />
          <input 
            type="text" 
            placeholder="Search" 
            className="h-8 w-64 rounded-md border border-zinc-700 bg-zinc-800/50 pl-9 pr-14 text-sm text-zinc-200 placeholder-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500" 
          />
          <div className="absolute right-2 flex items-center gap-1">
            <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400">Ctrl+K</kbd>
          </div>
        </div>

        <div className="grid h-8 w-8 place-items-center rounded-full bg-zinc-700 text-xs font-medium text-zinc-200">
          {initials || 'FI'}
        </div>
      </div>
    </header>
  );
}

