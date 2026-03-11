"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import AdminNavbar from "@/components/AdminNavbar";
import type {
  AdminSession,
  ApiErrorResponse,
  CreateSignLinkResponse,
  MeResponse,
  OfficialsPayload,
  RequestRecord,
  RequestStatus,
  RequestsResponse,
} from "@/lib/types/api";
import {
  ShieldCheck,
  History,
  X,
  Clock,
  User,
  Globe,
  Search,
  FileText
} from "lucide-react";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAdminSession(value: unknown): value is AdminSession {
  if (!isRecord(value)) return false;
  return (
    typeof value.sub === "string" &&
    typeof value.username === "string" &&
    typeof value.exp === "number"
  );
}

function isMeResponse(value: unknown): value is MeResponse {
  if (!isRecord(value) || typeof value.authenticated !== "boolean") return false;
  if (!value.authenticated) return true;
  return isAdminSession(value.session);
}

function isRequestsResponse(value: unknown): value is RequestsResponse {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.requests)) return false;
  return (
    typeof value.total === "number" &&
    typeof value.page === "number" &&
    typeof value.limit === "number" &&
    typeof value.pages === "number"
  );
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return isRecord(value) && typeof value.error === "string";
}

function isCreateSignLinkResponse(value: unknown): value is CreateSignLinkResponse {
  return (
    isRecord(value) &&
    typeof value.sign_url === "string" &&
    typeof value.token === "string" &&
    typeof value.role === "string" &&
    typeof value.channel === "string" &&
    typeof value.expires_at === "string" &&
    typeof value.email_sent === "boolean"
  );
}

function isOfficialsPayload(value: unknown): value is OfficialsPayload {
  return (
    isRecord(value) &&
    typeof value.registrar_name === "string" &&
    typeof value.director_name === "string"
  );
}

type OfficialRole = "registrar" | "director";

type AuditLog = {
  id: string;
  request_id: string;
  role: string;
  action: string;
  document_hash: string;
  ip_address: string;
  user_agent: string;
  timestamp: string;
};

export default function RequestsClient() {
  const router = useRouter();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [data, setData] = useState<RequestsResponse>({ requests: [], total: 0, page: 1, limit: 20, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [officialEmails, setOfficialEmails] = useState<{ registrar: string; director: string }>({ registrar: "", director: "" });
  const [linksModalOpen, setLinksModalOpen] = useState(false);
  const [linksModalLoading, setLinksModalLoading] = useState(false);
  const [linksModalError, setLinksModalError] = useState("");
  const [linksModalCopyMessage, setLinksModalCopyMessage] = useState("");
  const [sendingRole, setSendingRole] = useState<OfficialRole | null>(null);
  const [activeModalRequest, setActiveModalRequest] = useState<{ id: string; label: string } | null>(null);
  const [modalLinks, setModalLinks] = useState<Record<OfficialRole, CreateSignLinkResponse | null>>({
    registrar: null,
    director: null,
  });
  const searchParams = useSearchParams();
  const pageParam = searchParams?.get("page") ?? "1";

  // Audit Log State
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState("");
  const [activeAuditRequest, setActiveAuditRequest] = useState<RequestRecord | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) {
          router.replace("/login");
          return;
        }
        const payload: unknown = await res.json().catch(() => null);
        if (!isMeResponse(payload) || !payload.authenticated) {
          router.replace("/login");
          return;
        }
        setSession(payload.session);
      } catch {
        router.replace("/login");
      }
    };

    void checkAuth();
  }, [router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!session) return;

      setLoading(true);
      // Read page from client-side search params
      let page = parseInt(pageParam, 10);
      if (Number.isNaN(page) || page < 1) page = 1;
      const limit = 20;

      // Fetch request data from Next.js server-side proxy
      try {
        const res = await fetch(`/api/requests?page=${page}&limit=${limit}`, { cache: "no-store" });
        if (res.ok) {
          const responseData: unknown = await res.json().catch(() => null);
          if (isRequestsResponse(responseData)) {
            setData(responseData);
          }
        }
      } catch (error) {
        console.error("Failed to fetch requests:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, [pageParam, session]);

  useEffect(() => {
    if (!session) return;

    let active = true;
    const loadOfficialEmails = async () => {
      try {
        const res = await fetch("/api/backend/officials", { cache: "no-store" });
        const payload: unknown = await res.json().catch(() => null);
        if (!active || !res.ok || !isOfficialsPayload(payload)) {
          return;
        }
        setOfficialEmails({
          registrar: (payload.registrar_email || "").trim(),
          director: (payload.director_email || "").trim(),
        });
      } catch {
        // keep default empty emails
      }
    };

    void loadOfficialEmails();
    return () => {
      active = false;
    };
  }, [session]);

  const handleUpdateStatus = async (requestId: string, status: RequestStatus) => {
    // Find index and previous status
    const idx = data.requests.findIndex((r) => r.id === requestId);
    if (idx === -1) return;
    const currentRequest = data.requests[idx];
    if (!currentRequest) return;
    const prevStatus = currentRequest.status;

    // Optimistic update
    const updatedRequests = [...data.requests];
    updatedRequests[idx] = { ...currentRequest, status };
    setData((prev) => ({ ...prev, requests: updatedRequests }));

    try {
      const response = await fetch(`/api/requests/${requestId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        // Revert status and alert error
        updatedRequests[idx] = { ...currentRequest, status: prevStatus };
        setData((prev) => ({ ...prev, requests: updatedRequests }));
        const errorText = await response.text().catch(() => "เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
        alert(errorText || "เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
        return;
      }
      // Optionally refresh data from backend (optional, UX อาจไม่ต้อง)
      // const searchParams = new URLSearchParams(window.location.search);
      // const page = parseInt(searchParams.get('page') || '1', 10);
      // const limit = 20;
      // const res = await fetch(`/api/requests?page=${page}&limit=${limit}`, { cache: "no-store" });
      // if (res.ok) {
      //   const responseData = await res.json();
      //   setData(responseData);
      // }
    } catch (error) {
      // Revert status and alert error
      updatedRequests[idx] = { ...currentRequest, status: prevStatus };
      setData((prev) => ({ ...prev, requests: updatedRequests }));
      alert("เกิดข้อผิดพลาดในการเปลี่ยนสถานะ");
      console.error("Error updating status:", error);
    }
  };

  const handlePrintPDF = async (requestId: string) => {
    try {
      // Fetch PDF through Next.js proxy
      const response = await fetch(`/api/pdf/${requestId}`, { method: 'GET', cache: 'no-store' });
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

  const copyText = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for insecure context (e.g. HTTP access by IP)
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
      }
    } catch (err) {
      console.error("Copy failed: ", err);
      return false;
    }
  };

  const createSignLink = async (
    requestId: string,
    role: OfficialRole,
    channel: "email" | "copy"
  ): Promise<CreateSignLinkResponse> => {
    const res = await fetch(`/api/requests/${requestId}/sign-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, channel }),
    });

    const data: unknown = await res.json().catch(() => null);
    if (!res.ok || !isCreateSignLinkResponse(data)) {
      if (isApiErrorResponse(data)) {
        throw new Error(data.error);
      }
      throw new Error("ไม่สามารถสร้างลิงก์ลงนามได้");
    }
    return data;
  };

  const handleCopyRoleLink = async (role: OfficialRole, currentLinks = modalLinks) => {
    const link = currentLinks[role]?.sign_url;
    if (!link) return;
    const copied = await copyText(link);
    setLinksModalCopyMessage(copied ? `คัดลอกลิงก์${role === "registrar" ? "นายทะเบียน" : "ผู้อำนวยการ"}แล้ว` : "คัดลอกไม่สำเร็จ กรุณาคัดลอกด้วยตนเอง");
  };

  const copyLinkBundle = async (links: Record<OfficialRole, CreateSignLinkResponse | null>) => {
    if (!links.registrar || !links.director) return;
    const text = `ลิงก์นายทะเบียน: ${links.registrar.sign_url}\nลิงก์ผู้อำนวยการ: ${links.director.sign_url}`;
    const copied = await copyText(text);
    setLinksModalCopyMessage(copied ? "คัดลอกลิงก์ทั้งสองบทบาทให้อัตโนมัติแล้ว" : "คัดลอกอัตโนมัติไม่สำเร็จ กรุณากดคัดลอกด้วยตนเอง");
  };

  const openLinksModal = async (request: RequestRecord, autoCopyRole: OfficialRole | "both" = "both") => {
    setActiveModalRequest({ id: request.id, label: `${request.prefix} ${request.name}` });
    setLinksModalOpen(true);
    setLinksModalLoading(true);
    setLinksModalError("");
    setLinksModalCopyMessage("");
    setModalLinks({ registrar: null, director: null });

    try {
      const [registrar, director] = await Promise.all([
        createSignLink(request.id, "registrar", "copy"),
        createSignLink(request.id, "director", "copy"),
      ]);

      const nextLinks = { registrar, director };
      setModalLinks(nextLinks);
      if (autoCopyRole === "both") {
        await copyLinkBundle(nextLinks);
      } else {
        await handleCopyRoleLink(autoCopyRole, nextLinks);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดระหว่างสร้างลิงก์ลงนาม";
      setLinksModalError(message);
    } finally {
      setLinksModalLoading(false);
    }
  };

  const closeLinksModal = () => {
    setLinksModalOpen(false);
    setLinksModalLoading(false);
    setLinksModalError("");
    setLinksModalCopyMessage("");
    setSendingRole(null);
    setActiveModalRequest(null);
    setModalLinks({ registrar: null, director: null });
  };

  const handleSendRoleEmail = async (role: OfficialRole) => {
    if (!activeModalRequest) return;

    setSendingRole(role);
    setLinksModalError("");
    try {
      const response = await createSignLink(activeModalRequest.id, role, "email");
      setModalLinks((prev) => ({ ...prev, [role]: response }));
      if (response.email_sent) {
        setLinksModalCopyMessage(`ส่งอีเมลลิงก์${role === "registrar" ? "นายทะเบียน" : "ผู้อำนวยการ"}เรียบร้อย`);
      } else {
        setLinksModalError(response.warning || "สร้างลิงก์แล้ว แต่ส่งอีเมลไม่สำเร็จ");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาดระหว่างส่งอีเมล";
      setLinksModalError(message);
    } finally {
      setSendingRole(null);
    }
  };

  const openAuditModal = async (request: RequestRecord) => {
    setActiveAuditRequest(request);
    setAuditModalOpen(true);
    setAuditLoading(true);
    setAuditError("");
    setAuditLogs([]);

    const hashes = [
      request.signatures?.director?.document_hash,
      request.signatures?.registrar?.document_hash,
      request.signatures?.student?.document_hash,
      request.decisions?.director?.document_hash,
      request.decisions?.registrar?.document_hash
    ].filter((h): h is string => !!h);

    if (hashes.length === 0) {
      setAuditError("ยังไม่มีประวัติการลงนามสำหรับคำร้องนี้");
      setAuditLoading(false);
      return;
    }

    const targetHash = hashes[0];

    try {
      const res = await fetch(`/api/verify?hash=${encodeURIComponent(targetHash as string)}`);
      if (!res.ok) throw new Error("ไม่สามารถเรียกดูประวัติได้");
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch {
      setAuditError("เกิดข้อผิดพลาดในการโหลดข้อมูลประวัติ");
    } finally {
      setAuditLoading(false);
    }
  };

  const closeAuditModal = () => {
    setAuditModalOpen(false);
    setActiveAuditRequest(null);
    setAuditLogs([]);
  };

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-slate-500">กำลังตรวจสอบสิทธิ์การเข้าใช้...</div>
    </div>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">กำลังโหลดข้อมูลคำร้อง...</div>
      </div>
    );
  }

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

          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {data.requests.length > 0 ? (
              data.requests.map((request, index) => (
                <div key={request.id} className="rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 shadow-sm p-4 space-y-3">
                  {/* Card Header: Index + Name + Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 pt-0.5">#{(data.page - 1) * data.limit + index + 1}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                          {request.prefix} {request.name}
                        </div>
                        {request.father_name && request.mother_name && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                            บิดา: {request.father_name} | มารดา: {request.mother_name}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${request.status === 'completed'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : request.status === 'cancelled'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      }`}>
                      {request.status === 'completed' ? 'สำเร็จ' : request.status === 'cancelled' ? 'ยกเลิก' : 'รออนุมัติ'}
                    </span>
                  </div>

                  {/* Card Info Row */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <div>
                      <span className="text-slate-400 dark:text-slate-500">ประเภท </span>
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px] font-medium">
                        {request.document_type}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 dark:text-slate-500">ชั้น: </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {request.class && request.room ? `${request.class}/${request.room}` : '-'}
                      </span>
                      {request.academic_year && (
                        <span className="text-slate-400 dark:text-slate-500"> ปี {request.academic_year}</span>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 dark:text-slate-500">วัตถุประสงค์: </span>
                      <span className="text-slate-700 dark:text-slate-300 line-clamp-2">{request.purpose}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 dark:text-slate-500">วันที่ส่ง: </span>
                      <span className="text-slate-700 dark:text-slate-300">
                        {new Date(request.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' '}
                        {new Date(request.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <button
                      onClick={() => handlePrintPDF(request.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                      </svg>
                      ปพ.1
                    </button>
                    <button
                      onClick={() => void openLinksModal(request)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-cyan-700 dark:text-cyan-200 bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-700 rounded-lg hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors cursor-pointer shadow-sm"
                    >
                      ลิงก์ลงนาม
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(request.id, 'completed')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors cursor-pointer shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      สำเร็จ
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(request.id, 'cancelled')}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors cursor-pointer shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      ยกเลิก
                    </button>
                    <button
                      onClick={() => void openAuditModal(request)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-sm"
                    >
                      <History className="w-3.5 h-3.5" />
                      ประวัติ
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 shadow-sm p-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-12 h-12 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="text-slate-500 dark:text-slate-400">
                    <div className="font-medium">ไม่มีข้อมูลคำร้อง</div>
                    <div className="text-sm">ยังไม่มีนักเรียนส่งคำร้องเข้ามาในระบบ</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block rounded-2xl border border-slate-200/50 dark:border-slate-700/50 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">

              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider w-12">ลำดับ</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider min-w-[160px]">ชื่อ-นามสกุล</th>
                    <th className="hidden px-4 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"></th>
                    <th className="hidden px-4 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"></th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">ประเภท</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">ชั้น/ปีการศึกษา</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">วัตถุประสงค์</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">สถานะ</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">เมื่อ</th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {data.requests.length > 0 ? (
                    data.requests.map((request, index) => (
                      <tr key={request.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          {(data.page - 1) * data.limit + index + 1}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                              {request.prefix} {request.name}
                            </div>
                            {request.father_name && request.mother_name && (
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                                บิดา: {request.father_name} | มารดา: {request.mother_name}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="hidden px-4 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          {request.id_card}
                        </td>
                        <td className="hidden px-4 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          {request.student_id || '-'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {request.document_type}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-900 dark:text-slate-100">
                          {request.class && request.room ? `${request.class}/${request.room}` : '-'}
                          {request.academic_year && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              ปีการศึกษา {request.academic_year}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-xs text-slate-900 dark:text-slate-100 max-w-[140px] line-clamp-2 overflow-hidden" title={request.purpose}>
                            {request.purpose}
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${request.status === 'completed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : request.status === 'cancelled'
                              ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            }`}>
                            {request.status === 'completed' ? 'สำเร็จ' : request.status === 'cancelled' ? 'ยกเลิก' : 'รออนุมัติ'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex flex-col leading-tight">
                            <span>{new Date(request.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                            <span className="opacity-60">{new Date(request.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handlePrintPDF(request.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-sm"
                                title="ปรินท์ PDF ของ ปพ.1"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                </svg>
                                ปพ.1
                              </button>

                              <button
                                onClick={() => void openLinksModal(request, "registrar")}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-cyan-700 dark:text-cyan-200 bg-cyan-50 dark:bg-cyan-900/30 border border-cyan-200 dark:border-cyan-700 rounded hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors cursor-pointer shadow-sm"
                                title="สร้างลิงก์ลงนามนายทะเบียน"
                              >
                                ลิงก์นายทะเบียน
                              </button>

                              <button
                                onClick={() => void openLinksModal(request, "director")}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-indigo-700 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors cursor-pointer shadow-sm"
                                title="สร้างลิงก์ลงนามผู้อำนวยการ"
                              >
                                ลิงก์ผอ.
                              </button>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleUpdateStatus(request.id, 'completed')}
                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium text-green-700 dark:text-green-200 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors cursor-pointer shadow-sm"
                                title="อนุมัติคำร้อง"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                สำเร็จ
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(request.id, 'cancelled')}
                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium text-red-700 dark:text-red-200 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors cursor-pointer shadow-sm"
                                title="ยกเลิกคำร้อง"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                ยกเลิก
                              </button>
                              <button
                                onClick={() => void openAuditModal(request)}
                                className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-sm"
                                title="ดูประวัติการลงนาม (Audit Trail)"
                              >
                                <History className="w-3 h-3" />
                                ประวัติ
                              </button>
                            </div>
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
            </div >
          </div >

          {/* Pagination */}
          {
            data.pages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-4 bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-sm">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  หน้า {data.page} จาก {data.pages}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
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
                        className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${pageNum === data.page
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
            )
          }
        </div >
      </main >

      {linksModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">ลิงก์ลงนามเจ้าหน้าที่</h2>
                <p className="text-sm text-slate-600">คำร้อง: {activeModalRequest?.label || "-"}</p>
              </div>
              <button
                type="button"
                onClick={closeLinksModal}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                ปิด
              </button>
            </div>

            {linksModalLoading ? (
              <div className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm text-cyan-700">
                กำลังสร้างลิงก์นายทะเบียนและผู้อำนวยการ...
              </div>
            ) : null}

            {linksModalError ? (
              <div className="mb-3 rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {linksModalError}
              </div>
            ) : null}

            {linksModalCopyMessage ? (
              <div className="mb-3 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {linksModalCopyMessage}
              </div>
            ) : null}

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-sm font-semibold text-slate-800">นายทะเบียน</div>
                <input
                  readOnly
                  value={modalLinks.registrar?.sign_url || ""}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                  placeholder="ยังไม่มีลิงก์"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyRoleLink("registrar")}
                    disabled={!modalLinks.registrar}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    คัดลอกลิงก์
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSendRoleEmail("registrar")}
                    disabled={!officialEmails.registrar || sendingRole === "registrar"}
                    className="rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                  >
                    {sendingRole === "registrar" ? "กำลังส่งอีเมล..." : "ส่งอีเมล"}
                  </button>
                  {!officialEmails.registrar ? (
                    <span className="text-xs text-slate-500">ยังไม่ตั้งค่าอีเมลนายทะเบียน</span>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 text-sm font-semibold text-slate-800">ผู้อำนวยการ</div>
                <input
                  readOnly
                  value={modalLinks.director?.sign_url || ""}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                  placeholder="ยังไม่มีลิงก์"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyRoleLink("director")}
                    disabled={!modalLinks.director}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                  >
                    คัดลอกลิงก์
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSendRoleEmail("director")}
                    disabled={!officialEmails.director || sendingRole === "director"}
                    className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-xs text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    {sendingRole === "director" ? "กำลังส่งอีเมล..." : "ส่งอีเมล"}
                  </button>
                  {!officialEmails.director ? (
                    <span className="text-xs text-slate-500">ยังไม่ตั้งค่าอีเมลผู้อำนวยการ</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {auditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 dark:bg-cyan-900/50 rounded-xl">
                  <History className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">บันทึกประวัติการลงนาม</h2>
                  <p className="text-xs text-slate-500">Audit Trail: {activeAuditRequest?.prefix} {activeAuditRequest?.name}</p>
                </div>
              </div>
              <button onClick={closeAuditModal} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400">
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {auditLoading ? (
                <div className="py-20 text-center">
                  <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                  <p className="text-sm text-slate-500">กำลังโหลดประวัติ...</p>
                </div>
              ) : auditError ? (
                <div className="py-20 text-center space-y-4">
                  <ShieldCheck className="mx-auto h-12 w-12 text-slate-300" />
                  <p className="text-slate-500 font-medium">{auditError}</p>
                </div>
              ) : (
                <div className="relative space-y-6 before:absolute before:left-8 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-slate-100 dark:before:bg-slate-800">
                  {auditLogs.map((log, idx) => (
                    <div key={log.id} className="relative pl-16">
                      <div className="absolute left-4 top-1 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold border border-slate-200 dark:border-slate-700">
                        {idx + 1}
                      </div>
                      <div className="rounded-2xl bg-white dark:bg-slate-950 p-5 border border-slate-100 dark:border-slate-800 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 dark:border-slate-800 pb-3 mb-3">
                          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-slate-100 uppercase text-xs tracking-wider">
                            <User className="h-3 w-3 text-cyan-600" />
                            {log.role === 'student' ? 'ผู้ยื่นคำร้อง' : log.role === 'registrar' ? 'นายทะเบียน' : 'ผู้อำนวยการ'}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <Clock className="h-3 w-3" />
                            {new Date(log.timestamp).toLocaleString("th-TH")}
                          </div>
                        </div>

                        <p className="mb-4 text-sm font-semibold text-cyan-700 dark:text-cyan-400">
                          {log.action === 'sign' ? 'ลงลายมือชื่อ' : log.action === 'approve' ? 'อนุมัติคำร้อง' : 'ปฏิเสธคำร้อง'}
                        </p>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg border border-slate-200/50 dark:border-slate-800">
                            <FileText className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="text-[10px] text-slate-500 font-mono truncate" title={log.document_hash}>HASH: {log.document_hash}</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-900 text-[10px] text-slate-500">
                              <Globe className="h-3 w-3" />
                              IP: {log.ip_address}
                            </div>
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-900 text-[10px] text-slate-500 max-w-full">
                              <Search className="h-3 w-3 shrink-0" />
                              <span className="truncate">{log.user_agent}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800">
              <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest font-bold">
                Immutable Record Protection • ETDA Compliant
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
