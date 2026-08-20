import React from 'react';
import { RefreshCw, Search, Plus, CheckCircle2, AlertCircle, Menu } from 'lucide-react';
import Button from '@/components/ui/Button';

interface TopHeaderProps {
  title: string;
  subtitle?: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isLive: boolean;
  isSyncing: boolean;
  onRefresh: () => void;
  onNewAction?: () => void;
  newActionLabel?: string;
  onOpenMobileMenu?: () => void;
}

export default function TopHeader({
  title,
  subtitle,
  searchQuery,
  onSearchChange,
  isLive,
  isSyncing,
  onRefresh,
  onNewAction,
  newActionLabel,
  onOpenMobileMenu,
}: TopHeaderProps) {
  return (
    <header className="bg-white border-b border-[#E6D9C7] sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-3.5 sm:py-4 flex flex-col gap-3">
      {/* Top Row: Mobile Menu + Title + Sync Status Badge + Actions */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Mobile Hamburger Button */}
          {onOpenMobileMenu && (
            <button
              onClick={onOpenMobileMenu}
              className="lg:hidden p-2 rounded-xl border border-[#E6D9C7] text-[#4C2224] hover:bg-[#FAF5EE] transition-colors cursor-pointer"
              aria-label="Open Navigation Menu"
            >
              <Menu size={20} />
            </button>
          )}

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-xl sm:text-2xl font-bold text-[#241C1B]">{title}</h1>
              <div
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                style={{
                  backgroundColor: isLive ? '#EBF1E8' : '#FAF5EE',
                  borderColor: isLive ? '#8A9A7B' : '#E6D9C7',
                  color: isLive ? '#28451B' : '#6B5D50',
                }}
              >
                {isLive ? (
                  <>
                    <CheckCircle2 size={12} className="text-[#4A6B3A]" />
                    <span>Live Sync</span>
                  </>
                ) : (
                  <>
                    <AlertCircle size={12} className="text-[#B8862B]" />
                    <span>Local Mode</span>
                  </>
                )}
              </div>
            </div>
            {subtitle && <p className="text-xs text-[#6B5D50] mt-0.5 hidden sm:block">{subtitle}</p>}
          </div>
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            isLoading={isSyncing}
            icon={<RefreshCw size={13} className={isSyncing ? 'animate-spin' : ''} />}
          >
            <span className="hidden sm:inline">Sync</span>
          </Button>

          {onNewAction && newActionLabel && (
            <Button
              variant="primary"
              size="sm"
              onClick={onNewAction}
              icon={<Plus size={14} />}
            >
              <span>{newActionLabel}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Second Row on Mobile / Integrated Search */}
      <div className="relative w-full">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B5D50]" />
        <input
          type="text"
          placeholder="Search orders, SKU formats, phone numbers, governorates..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-[#FAF5EE] border border-[#E6D9C7] rounded-xl pl-9 pr-3 py-2 text-xs text-[#241C1B] placeholder-[#6B5D50]/60 focus:outline-none focus:border-[#4C2224] focus:ring-1 focus:ring-[#4C2224]"
        />
      </div>
    </header>
  );
}
