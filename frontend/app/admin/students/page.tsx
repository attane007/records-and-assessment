import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionFromCookies } from "../../../lib/session";
import "server-only";

interface StudentRecord {
  id: string;
  prefix: string;
  name: string;
  document_type: string;
  id_card: string;
  date_of_birth: string;
  class?: string;
  room?: string;
  academic_year?: string;
  father_name?: string;
  mother_name?: string;
  purpose: string;
  created_at: string;
}

interface StudentsResponse {
  students: StudentRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await getSessionFromCookies();
  if (!session) redirect("/login");

  const page = parseInt(searchParams.page || "1");
  const limit = 20;

  // Fetch student data from backend
  const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
  let data: StudentsResponse = { students: [], total: 0, page: 1, limit: 20, pages: 0 };
  
  try {
    const res = await fetch(`${backendURL}/api/students?page=${page}&limit=${limit}`, { 
      cache: "no-store" 
    });
    if (res.ok) {
      data = await res.json();
    }
  } catch (error) {
    console.error("Failed to fetch students:", error);
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-cyan-50/30 to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <header className="w-full border-b border-cyan-200/50 dark:border-cyan-800/30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                  รายการคำร้อง
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">จัดการและดูรายการคำร้องของนักเรียน</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-sm text-slate-600 dark:text-slate-300">สวัสดี, {session.username}</span>
              </div>

              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white/60 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                กลับแผงควบคุม
              </Link>

              <Link
                href="/"
                className="hidden sm:inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white/60 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                หน้าหลัก
              </Link>

              <form action="/api/logout" method="post">
                <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  ออกจากระบบ
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Summary Card */}
          <div className="rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">รายการคำร้องทั้งหมด</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">แสดงผลลัพธ์ {Math.min((data.page - 1) * data.limit + 1, data.total)}-{Math.min(data.page * data.limit, data.total)} จาก {data.total} รายการ</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{data.total}</div>
                <div className="text-sm text-slate-500 dark:text-slate-400">คำร้องทั้งหมด</div>
              </div>
            </div>
          </div>

          {/* Students Table */}
          <div className="rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">ลำดับ</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">ชื่อ-นามสกุล</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">เลขประจำตัว</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">ประเภทเอกสาร</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">ชั้น</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">วัตถุประสงค์</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">วันที่ส่ง</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {data.students.length > 0 ? (
                    data.students.map((student, index) => (
                      <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          {(data.page - 1) * data.limit + index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {student.prefix} {student.name}
                            </div>
                            {student.father_name && student.mother_name && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                บิดา: {student.father_name} | มารดา: {student.mother_name}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          {student.id_card}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {student.document_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          {student.class && student.room ? `${student.class}/${student.room}` : '-'}
                          {student.academic_year && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              ปีการศึกษา {student.academic_year}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-900 dark:text-slate-100 max-w-xs truncate">
                            {student.purpose}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                          {formatDate(student.created_at)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <svg className="w-12 h-12 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <div className="text-slate-500 dark:text-slate-400">
                            <div className="font-medium">ไม่มีข้อมูลคำร้อง</div>
                            <div className="text-sm">ยังไม่มีนักเรียนส่งคำร้องเข้ามาในระบบ</div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {data.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 rounded-b-2xl">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  หน้า {data.page} จาก {data.pages}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {data.page > 1 && (
                  <Link
                    href={`/admin/students?page=${data.page - 1}`}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    ก่อนหน้า
                  </Link>
                )}
                
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, data.pages) }, (_, i) => {
                  const pageNum = Math.max(1, Math.min(data.pages - 4, data.page - 2)) + i;
                  if (pageNum > data.pages) return null;
                  
                  return (
                    <Link
                      key={pageNum}
                      href={`/admin/students?page=${pageNum}`}
                      className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                        pageNum === data.page
                          ? 'bg-cyan-500 text-white'
                          : 'text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {pageNum}
                    </Link>
                  );
                })}

                {data.page < data.pages && (
                  <Link
                    href={`/admin/students?page=${data.page + 1}`}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    ถัดไป
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
