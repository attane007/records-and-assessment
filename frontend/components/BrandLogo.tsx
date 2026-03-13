import Link from 'next/link';
import Image from 'next/image';

interface BrandLogoProps {
  href?: string;
  title?: string;
  subtitle?: string;
  className?: string;
  onClick?: () => void;
}

export default function BrandLogo({
  href,
  title = "ระบบขอ ปพ.1/ปพ.7",
  subtitle = "Records System",
  className = "",
  onClick
}: BrandLogoProps) {
  const content = (
    <div className={`flex items-center gap-3 hover:opacity-80 transition-all group shrink-0 ${className}`}>
      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-white dark:bg-slate-100 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 group-hover:rotate-3 transition-transform duration-300 overflow-hidden shrink-0">
        <Image src="/pp1-512x512.png" alt="Brand Logo" width={28} height={28} className="h-7 w-7 object-contain" />
      </div>
      <div className="hidden sm:block whitespace-nowrap">
        <div className="text-xl font-black bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent tracking-tight leading-tight">
          {title}
        </div>
        {subtitle && (
          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest -mt-0.5">
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} {...(onClick ? { onClick } : {})}>
        {content}
      </Link>
    );
  }

  return (
    <div {...(onClick ? { onClick } : {})} className={onClick ? "cursor-pointer" : ""}>
      {content}
    </div>
  );
}
