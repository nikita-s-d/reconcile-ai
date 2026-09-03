import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  UploadCloud,
  PlaySquare,
  Receipt,
  AlertTriangle,
  BarChart3,
  History,
  Settings,
  ShieldCheck,
  Wallet,
  Activity,
  Bot,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/assistant', label: 'Finance Controller AI', icon: Bot },
  { path: '/upload', label: 'Data Upload', icon: UploadCloud },
  { path: '/reconciliation', label: 'Reconciliation Agent', icon: PlaySquare },
  { path: '/transactions', label: 'Transactions', icon: Receipt },
  { path: '/exceptions', label: 'Exceptions', icon: AlertTriangle },
  { path: '/cash-position', label: 'Cash Position', icon: Wallet },
  { path: '/tax-verification', label: 'Tax Verification', icon: ShieldCheck },
  { path: '/run-history', label: 'Run History & Reports', icon: History },
  { path: '/analytics', label: 'Analytics / Evaluation', icon: BarChart3 },
  { path: '/audit-trail', label: 'Audit Trail', icon: Activity },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0">
      {/* Official Brand Logo Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-center">
        <BrandLogo size="small" variant="full" />
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 font-semibold'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800/60 hover:text-gray-900 dark:hover:text-white'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Tagline footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 text-center">
        <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
          Reconcile. Verify. Explain.
        </p>
      </div>
    </aside>
  );
};
