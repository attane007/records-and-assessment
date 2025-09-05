import Link from 'next/link';

interface AdminNavbarProps {
  session: {
    username: string;
  };
  currentPage: 'dashboard' | 'requests' | 'settings';
}

export default function AdminNavbar({ session, currentPage }: AdminNavbarProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo & Navigation */}
          <div className="flex items-center gap-6">
            {/* Logo */}
            <Link href="/admin" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <div className="text-lg font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  ระบบ ปพ.1
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 -mt-1">Admin Panel</div>
              </div>
            </Link>

            {/* Breadcrumb Navigation */}
            <nav className="hidden md:flex items-center gap-2 text-sm">
              <Link 
                href="/admin" 
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  currentPage === 'dashboard' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v3H8V5z" />
                  </svg>
                  แผงควบคุม
                </span>
              </Link>
              
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              
              <Link 
                href="/admin/requests" 
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  currentPage === 'requests' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  จัดการคำร้อง
                </span>
              </Link>

              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              
              <Link 
                href="/admin/settings" 
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  currentPage === 'settings' 
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' 
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  ตั้งค่า
                </span>
              </Link>
            </nav>
          </div>

          {/* Right: User Info & Actions */}
          <div className="flex items-center gap-4">
            {/* User Info */}
            <div className="hidden sm:flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-100/60 dark:bg-slate-800/60">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <div className="text-sm">
                <div className="font-medium text-slate-900 dark:text-slate-100">{session.username}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">ผู้ดูแลระบบ</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                title="กลับหน้าหลัก"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span className="hidden lg:inline">หน้าหลัก</span>
              </Link>

              <form action="/api/logout" method="post">
                <button 
                  className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors shadow-sm cursor-pointer"
                  title="ออกจากระบบ"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="hidden lg:inline">ออกจากระบบ</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
