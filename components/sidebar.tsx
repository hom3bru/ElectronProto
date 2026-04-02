'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, Inbox, Building2, FileSearch, CheckSquare, BookOpen, Send, Settings, Activity, ShieldCheck } from 'lucide-react';
import { clsx } from 'clsx';

const navItems = [
  { name: 'Browser', href: '/browser', icon: Globe },
  { name: 'Runs', href: '/browser/runs', icon: Activity },
  { name: 'Sites', href: '/browser/sites', icon: ShieldCheck },
  { name: 'Inbox', href: '/inbox', icon: Inbox },
  { name: 'CRM', href: '/crm', icon: Building2 },
  { name: 'Evidence', href: '/evidence', icon: FileSearch },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Notebook', href: '/notebook', icon: BookOpen },
  { name: 'Outreach', href: '/outreach', icon: Send },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col shrink-0">
      <div className="h-14 flex items-center px-4 border-b border-zinc-800">
        <span className="font-semibold text-sm tracking-tight">Agent Workspace</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-100'
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
