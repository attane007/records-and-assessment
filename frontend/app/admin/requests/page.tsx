import React, { Suspense } from "react";
import RequestsClient from "./RequestsClient";

export default function RequestsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">กำลังโหลดข้อมูลคำร้อง...</div>}>
      {/* Client component uses useSearchParams; keep it inside Suspense so prerender won't bail out */}
      <RequestsClient />
    </Suspense>
  );
}
