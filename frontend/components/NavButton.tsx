'use client';

import Link from 'next/link';
import { ReactNode } from 'react';

interface NavButtonProps {
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  children?: ReactNode;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  className?: string;
  title?: string;
  target?: string;
}

export default function NavButton({
  href,
  onClick,
  isActive,
  children,
  icon,
  variant = 'secondary',
  className = '',
  title,
  target,
}: NavButtonProps) {
  const baseStyles = "flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-black transition-all duration-300 active:scale-95 shadow-sm hover:shadow-md border border-transparent whitespace-nowrap";
  
  const variants = {
    primary: isActive
      ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 border-slate-200/50 dark:border-slate-600/50 scale-[1.02]"
      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50",
    secondary: isActive
      ? "bg-blue-600 text-white shadow-blue-500/20"
      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 bg-slate-50 dark:bg-slate-800/40 border-slate-200/40 dark:border-slate-700/40 hover:bg-slate-100 dark:hover:bg-slate-700/60",
    ghost: "text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/50",
    danger: "text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:border-rose-200 dark:hover:border-rose-900/50 bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700",
  };

  const content = (
    <>
      {icon && <span className="shrink-0">{icon}</span>}
      <span className="flex items-center">{children}</span>
    </>
  );

  const combinedClasses = `${baseStyles} ${variants[variant]} ${className}`;

  if (href) {
    return (
      <Link href={href} className={combinedClasses} title={title} target={target}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={combinedClasses} title={title}>
      {content}
    </button>
  );
}
