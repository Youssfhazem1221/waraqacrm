import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const variantStyles = {
    primary: 'bg-[#4C2224] text-[#FAF5EE] hover:bg-[#37181A] active:scale-[0.98] shadow-xs shadow-[#4C2224]/20 border border-[#4C2224]',
    secondary: 'bg-[#C0A286]/20 text-[#4C2224] hover:bg-[#C0A286]/35 active:scale-[0.98] border border-[#C0A286]/40',
    outline: 'bg-white text-[#241C1B] hover:bg-[#FAF5EE] hover:border-[#4C2224] border border-[#E6D9C7] active:scale-[0.98] shadow-xs',
    ghost: 'bg-transparent text-[#6B5D50] hover:text-[#4C2224] hover:bg-[#4C2224]/5 active:scale-[0.98]',
    danger: 'bg-[#A3492F] text-white hover:bg-[#853720] active:scale-[0.98] shadow-xs',
    success: 'bg-[#4A6B3A] text-white hover:bg-[#38522B] active:scale-[0.98] shadow-xs',
  };

  const sizeStyles = {
    sm: 'text-xs px-3 py-1.5 rounded-lg font-medium gap-1.5',
    md: 'text-sm px-4 py-2 rounded-xl font-semibold gap-2',
    lg: 'text-base px-6 py-2.5 rounded-xl font-semibold gap-2.5',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
