import Link from 'next/link';

interface AdminNavbarProps {
  session: {
    username: string;
  };
  currentPage: 'dashboard' | 'requests' | 'settings';
}

export default function AdminNavbar({ session, currentPage }: AdminNavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo Only */}
          <Link href="/admin" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="hidden sm:block">
              <div className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                ระบบ ปพ.1
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 -mt-1">Records & Assessment System</div>
            </div>
          </Link>

          {/* Right: Navigation & Actions */}
          <div className="flex items-center gap-3">
            {/* User Info */}
            <div className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-100/70 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <div className="text-sm">
                <div className="font-medium text-slate-900 dark:text-slate-100">{session.username}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">ผู้ดูแลระบบ</div>
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-600">
              <Link 
                href="/admin" 
                className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                  currentPage === 'dashboard' 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50 border-2 border-blue-700' 
                    : 'text-gray-900 dark:text-white bg-white dark:bg-gray-700 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-2 border-gray-300 dark:border-gray-500 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
                title="แผงควบคุม"
              >
                <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v3H8V5z" />
                </svg>
                <span className="hidden sm:inline">แผงควบคุม</span>
              </Link>
              
              <Link 
                href="/admin/requests" 
                className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                  currentPage === 'requests' 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/50 border-2 border-emerald-700' 
                    : 'text-gray-900 dark:text-white bg-white dark:bg-gray-700 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border-2 border-gray-300 dark:border-gray-500 hover:border-emerald-400 dark:hover:border-emerald-500'
                }`}
                title="จัดการคำร้อง"
              >
                <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="hidden sm:inline ">คำร้อง</span>
              </Link>

              <Link 
                href="/admin/settings" 
                className={`group relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 ${
                  currentPage === 'settings' 
                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/50 border-2 border-violet-700' 
                    : 'text-gray-900 dark:text-white bg-white dark:bg-gray-700 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/30 border-2 border-gray-300 dark:border-gray-500 hover:border-violet-400 dark:hover:border-violet-500'
                }`}
                title="ตั้งค่าระบบ"
              >
                <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">ตั้งค่า</span>
              </Link>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="group relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-100 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all duration-200 shadow-sm hover:shadow-md"
                title="กลับหน้าหลัก"
              >
                <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="hidden md:inline">หน้าหลัก</span>
              </Link>

              <form action="/api/logout" method="post">
                <button 
                  className="group relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-red-700 dark:text-red-100 bg-red-50 dark:bg-red-900/40 border border-red-300 dark:border-red-600 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/60 hover:border-red-400 dark:hover:border-red-500 transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer"
                  title="ออกจากระบบ"
                >
                  <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
