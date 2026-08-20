import React from 'react';
import { DollarSign, ShoppingBag, Users, AlertCircle, TrendingUp, PackageCheck } from 'lucide-react';
import type { AnalyticsMetrics } from '@/types';
import Card from '@/components/ui/Card';

interface OverviewStatsProps {
  metrics: AnalyticsMetrics;
}

export default function OverviewStats({ metrics }: OverviewStatsProps) {
  const stats = [
    {
      title: 'Total Gross Volume',
      value: `${metrics.totalRevenue.toLocaleString()} EGP`,
      sub: `${metrics.deliveredRevenue.toLocaleString()} EGP delivered & paid`,
      icon: DollarSign,
      color: 'maroon',
      iconBg: 'bg-[#4C2224]/10 text-[#4C2224]',
    },
    {
      title: 'Total Orders',
      value: metrics.totalOrders.toString(),
      sub: `${metrics.pendingOrders} pending · ${metrics.deliveredOrders} delivered`,
      icon: ShoppingBag,
      color: 'amber',
      iconBg: 'bg-[#B8862B]/15 text-[#734E09]',
    },
    {
      title: 'Average Order Value (AOV)',
      value: `${metrics.aov} EGP`,
      sub: 'Market sweet spot: 400–600 EGP',
      icon: TrendingUp,
      color: 'sage',
      iconBg: 'bg-[#8A9A7B]/20 text-[#38482D]',
    },
    {
      title: 'Active Workshop Inventory',
      value: `${metrics.totalStockUnits} units`,
      sub: `${metrics.lowStockSkus} SKUs low stock · ${metrics.outOfStockSkus} sold out`,
      icon: PackageCheck,
      color: 'kraft',
      iconBg: 'bg-[#C0A286]/25 text-[#4D3823]',
    },
    {
      title: 'Customer Directory',
      value: metrics.totalCustomers.toString(),
      sub: `${metrics.repeatCustomerRate}% repeat purchase rate`,
      icon: Users,
      color: 'blue',
      iconBg: 'bg-blue-500/15 text-blue-800',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {stats.map((st, i) => {
        const IconComp = st.icon;
        return (
          <Card key={i} className="flex flex-col justify-between p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#6B5D50] uppercase tracking-wider">
                {st.title}
              </span>
              <div className={`p-2 rounded-xl ${st.iconBg} shrink-0`}>
                <IconComp size={16} />
              </div>
            </div>
            <div className="mt-3">
              <div className="font-serif text-2xl font-bold text-[#241C1B]">
                {st.value}
              </div>
              <p className="text-[11px] text-[#6B5D50] mt-1 font-medium truncate">
                {st.sub}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
