import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'maroon' | 'sage' | 'amber' | 'emerald' | 'blue' | 'purple' | 'rose' | 'kraft' | 'gray';
  size?: 'sm' | 'md';
  className?: string;
  dot?: boolean;
}

export default function Badge({
  children,
  variant = 'maroon',
  size = 'md',
  className = '',
  dot = false,
}: BadgeProps) {
  const variantStyles = {
    maroon: 'bg-[#4C2224]/10 text-[#4C2224] border-[#4C2224]/20',
    sage: 'bg-[#8A9A7B]/15 text-[#38482D] border-[#8A9A7B]/30',
    amber: 'bg-[#B8862B]/15 text-[#734E09] border-[#B8862B]/30',
    emerald: 'bg-[#4A6B3A]/15 text-[#28451B] border-[#4A6B3A]/30',
    blue: 'bg-blue-500/15 text-blue-800 border-blue-500/30',
    purple: 'bg-purple-500/15 text-purple-800 border-purple-500/30',
    rose: 'bg-[#A3492F]/15 text-[#6D2714] border-[#A3492F]/30',
    kraft: 'bg-[#C0A286]/25 text-[#4D3823] border-[#C0A286]/40',
    gray: 'bg-gray-200/80 text-gray-700 border-gray-300',
  };

  const dotColors = {
    maroon: 'bg-[#4C2224]',
    sage: 'bg-[#8A9A7B]',
    amber: 'bg-[#B8862B]',
    emerald: 'bg-[#4A6B3A]',
    blue: 'bg-blue-600',
    purple: 'bg-purple-600',
    rose: 'bg-[#A3492F]',
    kraft: 'bg-[#C0A286]',
    gray: 'bg-gray-500',
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-semibold',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      <span>{children}</span>
    </span>
  );
}
