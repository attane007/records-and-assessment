import Link from 'next/link';

interface AdminNavbarProps {
  session: {
    username: string;
    accountId?: string;
  };
  currentPage: 'dashboard' | 'requests' | 'settings';
}

export default function AdminNavbar({ session, currentPage }: AdminNavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2">

          {/* Left: Logo */}
          <Link href="/admin" className="flex items-center gap-2 hover:opacity-80 transition-opacity shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <div className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent leading-normal pb-1">
                ระบบ ปพ.1
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5">Records &amp; Assessment System</div>
            </div>
          </Link>

          {/* Right: Nav + Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Username — hidden on small screens */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0"></div>
              <div className="text-sm">
                <div className="font-medium text-slate-900 dark:text-slate-100 leading-tight">{session.username}</div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Account: {session.accountId || 'standard'}</div>
              </div>
            </div>

            {/* Mobile Form Link Button — only on small screens */}
            {session.accountId && (
              <Link
                href={`/${session.accountId}`}
                target="_blank"
                className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 transition-all duration-200"
                title="เปิดลิงก์ฟอร์ม"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </Link>
            )}

            {/* Public Form Link Desktop — hidden on mobile */}
            {session.accountId && (
              <Link
                href={`/${session.accountId}`}
                target="_blank"
                className="hidden lg:flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-gradient-to-tr from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200/50 dark:border-blue-700/50 group hover:border-blue-400/50 dark:hover:border-blue-500/50 hover:shadow-md transition-all duration-300"
              >
                <span className="text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.1em] transition-colors leading-none">
                  Live Public Form
                </span>
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-700 flex items-center justify-center shadow-sm group-hover:shadow group-hover:scale-110 transition-all duration-300">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>
              </Link>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-600">
              <Link
                href="/admin"
                className={`group flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${currentPage === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 border-2 border-blue-700'
                  : 'text-gray-900 dark:text-white bg-white dark:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-2 border-gray-300 dark:border-gray-500'
                  }`}
                title="แผงควบคุม"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v3H8V5z" />
                </svg>
                <span className="hidden sm:inline">แผงควบคุม</span>
              </Link>

              <Link
                href="/admin/requests"
                className={`group flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${currentPage === 'requests'
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/40 border-2 border-emerald-700'
                  : 'text-gray-900 dark:text-white bg-white dark:bg-gray-700 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border-2 border-gray-300 dark:border-gray-500'
                  }`}
                title="จัดการคำร้อง"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline">คำร้อง</span>
              </Link>

              <Link
                href="/admin/settings"
                className={`group flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 ${currentPage === 'settings'
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/40 border-2 border-violet-700'
                  : 'text-gray-900 dark:text-white bg-white dark:bg-gray-700 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 border-2 border-gray-300 dark:border-gray-500'
                  }`}
                title="ตั้งค่าระบบ"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">ตั้งค่า</span>
              </Link>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/"
                className="flex items-center gap-1.5 px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all duration-200 shadow-sm"
                title="กลับหน้าหลัก"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="hidden md:inline">หน้าหลัก</span>
              </Link>

              <form action="/api/logout" method="post">
                <button
                  className="flex items-center gap-1.5 px-2 sm:px-3 py-2 text-xs sm:text-sm font-semibold text-red-700 dark:text-red-100 bg-red-50 dark:bg-red-900/40 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 transition-all duration-200 shadow-sm cursor-pointer"
                  title="ออกจากระบบ"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden md:inline">ออกจากระบบ</span>
                </button>
              </form>
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
