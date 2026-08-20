import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export default function Card({ children, className = '', hoverable = false }: CardProps) {
  return (
    <div
      className={`bg-white border border-[#E6D9C7] rounded-2xl p-5 shadow-xs transition-all ${
        hoverable ? 'hover:shadow-md hover:border-[#C0A286] cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}
