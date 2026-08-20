import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export default function Input({
  label,
  error,
  hint,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-[#241C1B]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full bg-white border border-[#E6D9C7] rounded-xl px-3.5 py-2 text-sm text-[#241C1B] placeholder-[#6B5D50]/50 transition-all focus:outline-none focus:border-[#4C2224] focus:ring-2 focus:ring-[#4C2224]/10 disabled:bg-[#FAF5EE] disabled:opacity-60 ${
          error ? 'border-[#A3492F] focus:border-[#A3492F] focus:ring-[#A3492F]/10' : ''
        } ${className}`}
        {...props}
      />
      {hint && !error && <p className="text-[11px] text-[#6B5D50]">{hint}</p>}
      {error && <p className="text-[11px] text-[#A3492F] font-medium">{error}</p>}
    </div>
  );
}
