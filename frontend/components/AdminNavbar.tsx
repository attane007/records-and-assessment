'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import QRModal from './QRModal';
import NavButton from './NavButton';

interface AdminNavbarProps {
  session: {
    username: string;
    accountId?: string;
  };
  currentPage: 'dashboard' | 'requests' | 'settings';
  publicFormUrl?: string;
}

export default function AdminNavbar({ session, currentPage, publicFormUrl }: AdminNavbarProps) {
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (shareDropdownRef.current && !shareDropdownRef.current.contains(event.target as Node)) {
        setIsShareOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyLink = () => {
    if (publicFormUrl) {
      navigator.clipboard.writeText(publicFormUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      setIsShareOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">

          {/* Left: Brand */}
          <div className="flex-1 flex justify-start pr-4">
            <Link href="/admin" className="flex items-center gap-3 hover:opacity-80 transition-all group shrink-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 group-hover:rotate-3 transition-transform duration-300">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <div className="text-xl font-black bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent tracking-tight">
                  ระบบ ปพ.1
                </div>
                <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest -mt-0.5">Records System</div>
              </div>
            </Link>
          </div>

          {/* Center: Primary Navigation */}
          <nav className="hidden md:flex items-center justify-center">
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/60 dark:bg-slate-800/60 backdrop-blur-md rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
              <NavButton
                href="/admin"
                variant="primary"
                isActive={currentPage === 'dashboard'}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v3H8V5z" />
                  </svg>
                }
              >
                Dashboard
              </NavButton>

              <NavButton
                href="/admin/requests"
                variant="primary"
                isActive={currentPage === 'requests'}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
              >
                คำร้อง
              </NavButton>

              <NavButton
                href="/admin/settings"
                variant="primary"
                isActive={currentPage === 'settings'}
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              >
                ตั้งค่า
              </NavButton>
            </div>
          </nav>

          {/* Right: Actions & Profile */}
          <div className="flex-1 flex items-center justify-end gap-2 sm:gap-4">
            {/* Quick Actions Group */}
            <div className="flex items-center gap-1.5 p-1.5 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-200/40 dark:border-slate-700/40 shadow-sm">
              {publicFormUrl && (
                <div className="relative" ref={shareDropdownRef}>
                  <NavButton
                    onClick={() => setIsShareOpen(!isShareOpen)}
                    variant={isShareOpen ? 'secondary' : 'primary'}
                    className={`!bg-blue-50/50 dark:!bg-blue-900/20 !text-blue-600 dark:!text-blue-400 !border-blue-200/50 dark:!border-blue-700/30 hover:!bg-blue-100 dark:hover:!bg-blue-900/40 ${isShareOpen ? '!bg-blue-600 !text-white !border-blue-500/50 !shadow-blue-500/20' : ''}`}
                    icon={
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    }
                  >
                    <span>แชร์ฟอร์ม</span>
                    <svg className={`w-3 h-3 shrink-0 transition-transform duration-300 ml-1 ${isShareOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </NavButton>

                  {/* Dropdown Menu */}
                  {isShareOpen && (
                    <div className="absolute top-full mt-2 left-0 sm:right-0 sm:left-auto w-48 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 shadow-xl shadow-slate-200/20 dark:shadow-black/20 overflow-hidden py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Link
                        href={publicFormUrl}
                        target="_blank"
                        className="flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        onClick={() => setIsShareOpen(false)}
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                        เปิดลิงก์ฟอร์ม
                      </Link>
                      
                      <button
                        onClick={handleCopyLink}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                          {copied ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                          )}
                        </div>
                        {copied ? 'คัดลอกแล้ว!' : 'คัดลอกลิงก์'}
                      </button>

                      <button
                        onClick={() => {
                          setIsQRModalOpen(true);
                          setIsShareOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                          </svg>
                        </div>
                        แสดง QR Code
                      </button>
                    </div>
                  )}
                </div>
              )}

              <NavButton
                href="/verify"
                variant="secondary"
                title="ตรวจสอบสถานะ"
                icon={
                  <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                }
              >
                <span className="hidden sm:inline">Status</span>
              </NavButton>

              <NavButton
                href="/"
                variant="secondary"
                title="หน้าหลัก"
                icon={
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                }
              >
                <span className="hidden sm:inline">Home</span>
              </NavButton>
            </div>

            {/* Separator */}
            <div className="hidden sm:block h-8 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>

            {/* Profile & Logout */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Profile Badge */}
              <div className="flex items-center gap-3 pl-1 pr-3 h-10 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all duration-300 group/profile cursor-default overflow-hidden">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center border border-slate-200/50 dark:border-slate-600/50 group-hover/profile:scale-105 transition-transform duration-300 shadow-sm shrink-0">
                  <span className="text-xs font-black text-slate-600 dark:text-slate-300 uppercase">
                    {session.username.substring(0, 1)}
                  </span>
                </div>
                
                {/* User Info */}
                <div className="hidden lg:block truncate">
                  <div className="text-[11px] font-black text-slate-800 dark:text-slate-100 leading-tight truncate">
                    {session.username}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></div>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                      ID: {session.accountId || 'Admin'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Logout Action */}
              <form action="/api/logout" method="post">
                <NavButton
                  variant="danger"
                  title="ออกจากระบบ"
                  className="!w-10 !h-10 !p-0 sm:!w-11 sm:!h-11 flex items-center justify-center shrink-0"
                  icon={
                    <svg className="w-5 h-5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  }
                />
              </form>
            </div>
          </div>

        </div>
      </div>

      {publicFormUrl && (
        <QRModal 
          isOpen={isQRModalOpen} 
          onClose={() => setIsQRModalOpen(false)} 
          url={publicFormUrl} 
        />
      )}
    </header>
  );
}
