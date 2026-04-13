import React from 'react';
import clsx from 'clsx';

const COLORS = [
  'bg-violet-600',
  'bg-blue-600',
  'bg-green-600',
  'bg-rose-600',
  'bg-amber-600',
  'bg-teal-600',
  'bg-pink-600',
  'bg-indigo-600',
  'bg-orange-600',
  'bg-cyan-600',
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-2xl',
};

export function Avatar({ name, size = 'md', className }: AvatarProps) {
  const color = getColor(name);
  const initials = getInitials(name || '?');
  return (
    <div
      className={clsx(
        'rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 select-none',
        color,
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  );
}
