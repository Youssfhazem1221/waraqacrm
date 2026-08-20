import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  Users, 
  BarChart3, 
  Settings, 
  ExternalLink, 
  Lock,
  Sparkles,
  X
} from 'lucide-react';
import type { ActiveTab } from '@/types';
import WaraqaLogo from '@/components/ui/WaraqaLogo';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingOrdersCount: number;
  lowStockCount: number;
  onLock: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  pendingOrdersCount,
  lowStockCount,
  onLock,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const navItems = [
    {
      key: 'dashboard' as ActiveTab,
      label: 'Overview',
      icon: LayoutDashboard,
    },
    {
      key: 'orders' as ActiveTab,
      label: 'Order Pipeline',
      icon: ShoppingBag,
      badge: pendingOrdersCount > 0 ? `${pendingOrdersCount} SLA` : undefined,
      badgeVariant: 'amber',
    },
    {
      key: 'inventory' as ActiveTab,
      label: 'Catalog & Stock',
      icon: Package,
      badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined,
      badgeVariant: 'rose',
    },
    {
      key: 'customers' as ActiveTab,
      label: 'Customer LTV',
      icon: Users,
    },
    {
      key: 'analytics' as ActiveTab,
      label: 'Financials & Unit Econ',
      icon: BarChart3,
    },
    {
      key: 'settings' as ActiveTab,
      label: 'Backend & Sync',
      icon: Settings,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-[#201513]/70 backdrop-blur-xs z-40 lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-auto w-72 lg:w-64 bg-[#201513] text-[#FAF5EE] flex flex-col justify-between border-r border-[#37181A] shrink-0 h-screen transition-transform duration-300 ease-in-out select-none ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Brand Section */}
        <div>
          <div className="p-5 lg:p-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <WaraqaLogo size={38} className="rounded-xl shadow-xs" />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-serif font-bold text-base tracking-wide text-white">Waraqa</span>
                  <span className="text-xs text-[#C0A286] font-arabic font-semibold">ورقة</span>
                </div>
                <span className="text-[10px] text-[#8A9A7B] font-mono tracking-widest uppercase flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8A9A7B] animate-pulse" />
                  Ops &amp; CRM Hub
                </span>
              </div>
            </div>

            {/* Mobile Close Button */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                aria-label="Close Menu"
              >
                <X size={20} />
              </button>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="p-3 sm:p-4 space-y-1.5">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setActiveTab(item.key);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#4C2224] text-white shadow-sm shadow-black/20 font-semibold'
                      : 'text-[#FAF5EE]/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent size={18} className={isActive ? 'text-[#C0A286]' : 'text-current'} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        item.badgeVariant === 'amber'
                          ? 'bg-[#B8862B] text-black font-bold'
                          : 'bg-[#A3492F] text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Footer Actions */}
        <div className="p-4 border-t border-white/10 space-y-2 text-xs">
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white/5 text-[#FAF5EE]/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-[#C0A286]" />
              <span>Open Storefront</span>
            </div>
            <ExternalLink size={14} />
          </a>

          <button
            onClick={onLock}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl text-[#FAF5EE]/60 hover:text-[#A3492F] hover:bg-[#A3492F]/10 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Lock size={14} />
              <span>Lock / Exit</span>
            </div>
            <span className="font-mono text-[10px]">ESC</span>
          </button>
        </div>
      </aside>
    </>
  );
}
