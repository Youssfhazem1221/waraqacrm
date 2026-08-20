import React from 'react';
import { TrendingUp, DollarSign, Truck, MapPin, AlertCircle, Sparkles, Award } from 'lucide-react';
import type { AnalyticsMetrics } from '@/types';
import Card from '@/components/ui/Card';
import { CURRENCY } from '@/lib/constants';

interface UnitEconomicsProps {
  metrics: AnalyticsMetrics;
}

export default function UnitEconomics({ metrics }: UnitEconomicsProps) {
  // Estimated workshop economics model from market deep-dive
  const estimatedCogsPercent = 0.38; // ~38% materials & binding costs
  const estimatedNetMargin = Math.round(metrics.deliveredRevenue * (1 - estimatedCogsPercent));
  const estimatedCourierLossPerOrder = 25; // Gap between flat 50 EGP charged vs 75-85 EGP avg courier fee
  const shippingReconciliation = metrics.deliveredOrders * estimatedCourierLossPerOrder;

  return (
    <div className="space-y-6">
      {/* Top Banner: Financial Overview */}
      <div className="bg-[#FAF5EE] border-2 border-[#4C2224]/20 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#4C2224]">
              Workshop Unit Economics Model
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#241C1B] mt-1">
              Financial Health &amp; Profitability
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold bg-[#4C2224] text-[#FAF5EE] px-3 py-1.5 rounded-full shadow-xs">
              Egypt D2C Benchmark
            </span>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-[#6B5D50] leading-relaxed max-w-3xl">
          Based on Waraqa's local handmade batch production model, our sketchbooks target high artist-grade quality at accessible pricing. Here is the operational reconciliation of revenue, courier subsidization, and regional volume.
        </p>
      </div>

      {/* 3 Strategic Scorecard Blocks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Metric 1: Realized Cash Inflow */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B5D50]">
              Realized Cash Revenue
            </span>
            <div className="p-2 rounded-xl bg-[#4A6B3A]/15 text-[#4A6B3A]">
              <DollarSign size={18} />
            </div>
          </div>
          <div>
            <div className="font-serif text-3xl font-bold text-[#4A6B3A]">
              {metrics.deliveredRevenue.toLocaleString()} <span className="text-sm font-sans font-normal text-[#6B5D50]">{CURRENCY}</span>
            </div>
            <p className="text-xs text-[#6B5D50] mt-1">
              From {metrics.deliveredOrders} delivered &amp; collected orders
            </p>
          </div>
          <div className="border-t border-[#E6D9C7] pt-3 text-xs text-[#6B5D50] flex justify-between">
            <span>Pending Pipeline Cash:</span>
            <strong className="text-[#241C1B]">{metrics.pendingRevenue.toLocaleString()} {CURRENCY}</strong>
          </div>
        </Card>

        {/* Metric 2: Estimated Gross Profit Contribution */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B5D50]">
              Gross Contribution Margin
            </span>
            <div className="p-2 rounded-xl bg-[#4C2224]/10 text-[#4C2224]">
              <TrendingUp size={18} />
            </div>
          </div>
          <div>
            <div className="font-serif text-3xl font-bold text-[#4C2224]">
              ~{estimatedNetMargin.toLocaleString()} <span className="text-sm font-sans font-normal text-[#6B5D50]">{CURRENCY}</span>
            </div>
            <p className="text-xs text-[#6B5D50] mt-1">
              Estimated ~62% gross profit margin on delivered goods
            </p>
          </div>
          <div className="border-t border-[#E6D9C7] pt-3 text-xs text-[#6B5D50] flex justify-between">
            <span>Estimated Materials COGS:</span>
            <strong className="text-[#241C1B]">~{(metrics.deliveredRevenue * estimatedCogsPercent).toFixed(0)} {CURRENCY}</strong>
          </div>
        </Card>

        {/* Metric 3: AOV vs Sweet Spot */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6B5D50]">
              Average Order Value (AOV)
            </span>
            <div className="p-2 rounded-xl bg-[#B8862B]/15 text-[#B8862B]">
              <Award size={18} />
            </div>
          </div>
          <div>
            <div className="font-serif text-3xl font-bold text-[#241C1B]">
              {metrics.aov} <span className="text-sm font-sans font-normal text-[#6B5D50]">{CURRENCY}</span>
            </div>
            <p className="text-xs text-[#6B5D50] mt-1">
              Market target: 400–600 EGP per customer checkout
            </p>
          </div>
          <div className="border-t border-[#E6D9C7] pt-3 text-xs text-[#6B5D50] flex justify-between">
            <span>Free Shipping Unlocks:</span>
            <strong className="text-[#241C1B]">Orders &gt; 800 {CURRENCY}</strong>
          </div>
        </Card>
      </div>

      {/* Governorate Shipment Breakdown */}
      <div className="bg-white border border-[#E6D9C7] rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-lg font-bold text-[#241C1B]">
              Regional Distribution Across Egypt
            </h3>
            <p className="text-xs text-[#6B5D50] mt-0.5">
              Shipment density across Greater Cairo, Alexandria, Delta, and Governorates
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-[#4C2224] font-semibold">
            <MapPin size={14} />
            <span>27 Governorates Covered</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-2">
          {Object.entries(metrics.govDistribution).map(([gov, count]) => {
            const percent = metrics.totalOrders > 0 ? Math.round((count / metrics.totalOrders) * 100) : 0;
            return (
              <div key={gov} className="bg-[#FAF5EE] border border-[#E6D9C7] rounded-2xl p-3.5 space-y-1">
                <div className="text-xs font-bold text-[#241C1B] truncate">{gov}</div>
                <div className="flex items-baseline justify-between">
                  <span className="font-serif text-lg font-bold text-[#4C2224]">{count}</span>
                  <span className="text-[10px] text-[#6B5D50] font-mono">{percent}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
