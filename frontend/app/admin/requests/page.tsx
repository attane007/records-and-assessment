"use client";

import Link from "next/link";
import { redirect } from "next/navigation";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import AdminNavbar from "@/components/AdminNavbar";

interface RequestRecord {
  id: string;
  prefix: string;
  name: string;
  document_type: string;
  id_card: string;
  student_id?: string;
  date_of_birth: string;
  class?: string;
  room?: string;
  academic_year?: string;
  father_name?: string;
  mother_name?: string;
  purpose: string;
  status: string; // pending, completed, cancelled
  created_at: string;
}

interface RequestsResponse {
  requests: RequestRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function RequestsPage() {
  const [session, setSession] = useState<any>(null);
  const [data, setData] = useState<RequestsResponse>({ requests: [], total: 0, page: 1, limit: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/me');
        if (!res.ok) {
          redirect('/login');
          return;
        }
        const payload = await res.json();
        setSession(payload.session);
      } catch (error) {
        redirect('/login');
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!session) return;
      
      setLoading(true);
      // Read page from client-side search params
      const rawPage = (searchParams?.get("page") as string) ?? "1";
      let page = parseInt(rawPage, 10);
      if (Number.isNaN(page) || page < 1) page = 1;
      const limit = 20;

      // Fetch request data from backend
      const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      
      try {
        const res = await fetch(`${backendURL}/api/requests?page=${page}&limit=${limit}`, { 
          cache: "no-store" 
        });
        if (res.ok) {
          const responseData = await res.json();
          setData(responseData);
        }
      } catch (error) {
        console.error("Failed to fetch requests:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session, searchParams?.get("page")]);

  const handleUpdateStatus = async (requestId: string, status: string) => {
    try {
      const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const response = await fetch(`${backendURL}/api/requests/${requestId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        // Refresh data after update
        const searchParams = new URLSearchParams(window.location.search);
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = 20;

        const res = await fetch(`${backendURL}/api/requests?page=${page}&limit=${limit}`, { 
          cache: "no-store" 
        });
        if (res.ok) {
          const responseData = await res.json();
          setData(responseData);
        }
        
        alert(`อัพเดตสถานะเป็น ${status === 'completed' ? 'สำเร็จ' : status === 'cancelled' ? 'ยกเลิก' : 'รออนุมัติ'} แล้ว`);
      } else {
        alert('ไม่สามารถอัพเดตสถานะได้ กรุณาลองใหม่อีกครั้ง');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('เกิดข้อผิดพลาดในการอัพเดตสถานะ');
    }
  };

  const handlePrintPDF = async (requestId: string) => {
    try {
      const backendURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";
      const pdfEndpoint = `${backendURL}/api/pdf/${requestId}`;

      // Always fetch as blob and force a download (no new tab)
      const response = await fetch(pdfEndpoint, { method: 'GET', cache: 'no-store' });
      if (!response.ok) {
        alert('ไม่สามารถสร้าง PDF ได้ กรุณาลองใหม่อีกครั้ง');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `request-${requestId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Revoke the object URL shortly after triggering the download
      setTimeout(() => {
        try { window.URL.revokeObjectURL(url); } catch { /* ignore */ }
      }, 5000);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('เกิดข้อผิดพลาดในการสร้าง PDF');
    }
  };

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-slate-500">กำลังตรวจสอบสิทธิ์การเข้าใช้...</div>
    </div>;
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
      <AdminNavbar session={session} currentPage="requests" />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* Page Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              จัดการคำร้อง ปพ.1
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              แสดงผลลัพธ์ {Math.min((data.page - 1) * data.limit + 1, data.total)}-{Math.min(data.page * data.limit, data.total)} จาก {data.total} รายการ
            </p>
          </div>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Requests Card */}
            <div className="rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300">คำร้องทั้งหมด</h3>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{data.total}</p>
                </div>
                <div className="p-3 bg-blue-500 rounded-xl">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Pending Requests Card */}
            <div className="rounded-2xl border border-orange-200/50 dark:border-orange-700/50 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-orange-700 dark:text-orange-300">รอดำเนินการ</h3>
                  <p className="text-2xl font-bold text-orange-900 dark:text-orange-100 mt-1">
                    {data.requests.filter(req => !req.status || req.status === 'pending').length}
                  </p>
                </div>
                <div className="p-3 bg-orange-500 rounded-xl">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Completed Requests Card */}
            <div className="rounded-2xl border border-green-200/50 dark:border-green-700/50 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-green-700 dark:text-green-300">สำเร็จ</h3>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
                    {data.requests.filter(req => req.status === 'completed').length}
                  </p>
                </div>
                <div className="p-3 bg-green-500 rounded-xl">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Cancelled Requests Card */}
            <div className="rounded-2xl border border-red-200/50 dark:border-red-700/50 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950 dark:to-red-900 p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-red-700 dark:text-red-300">ยกเลิก</h3>
                  <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">
                    {data.requests.filter(req => req.status === 'cancelled').length}
                  </p>
                </div>
                <div className="p-3 bg-red-500 rounded-xl">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
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
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">รหัสนักเรียน</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">ประเภทเอกสาร</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">ชั้น</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">วัตถุประสงค์</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">สถานะ</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">วันที่ส่ง</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {data.requests.length > 0 ? (
                    data.requests.map((request, index) => (
                      <tr key={request.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          {(data.page - 1) * data.limit + index + 1}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {request.prefix} {request.name}
                            </div>
                            {request.father_name && request.mother_name && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                บิดา: {request.father_name} | มารดา: {request.mother_name}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          {request.id_card}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          {request.student_id || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {request.document_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          {request.class && request.room ? `${request.class}/${request.room}` : '-'}
                          {request.academic_year && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              ปีการศึกษา {request.academic_year}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-slate-900 dark:text-slate-100 max-w-xs truncate">
                            {request.purpose}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            request.status === 'completed' 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : request.status === 'cancelled'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          }`}>
                            {request.status === 'completed' ? 'สำเร็จ' : request.status === 'cancelled' ? 'ยกเลิก' : 'รออนุมัติ'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                          {formatDate(request.created_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePrintPDF(request.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-sm"
                              title="ปรินท์ PDF ของ ปพ.1"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                              </svg>
                              ปพ.1
                            </button>
                            
                            <>
                                <button
                                  onClick={() => handleUpdateStatus(request.id, 'completed')}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors cursor-pointer shadow-sm"
                                  title="อนุมัติคำร้อง"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  สำเร็จ
                                </button>
                                <button
                                  onClick={() => handleUpdateStatus(request.id, 'cancelled')}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors cursor-pointer shadow-sm"
                                  title="ยกเลิกคำร้อง"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  ยกเลิก
                                </button>
                            </>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center">
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
                    href={`/admin/requests?page=${data.page - 1}`}
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
                      href={`/admin/requests?page=${pageNum}`}
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
                    href={`/admin/requests?page=${data.page + 1}`}
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
