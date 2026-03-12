import { NextResponse } from 'next/server';
import type { SubmitRequestBody } from '@/lib/types/api';

// Server-side proxy to backend. Use BACKEND_URL if provided, otherwise fall back to NEXT_PUBLIC_BACKEND_URL
const backendUrl = (process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://backend:8080').replace(/\/$/, '');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isSubmitRequestBody(value: unknown): value is SubmitRequestBody {
  if (!isRecord(value)) return false;
  return (
    typeof value.name === 'string' &&
    typeof value.prefix === 'string' &&
    typeof value.id_card === 'string' &&
    typeof value.date_of_birth === 'string' &&
    typeof value.purpose === 'string' &&
    typeof value.document_type === 'string'
  );
}

export async function POST(req: Request) {
  try {
    const url = `${backendUrl}/api/submit`;

    // forward body as JSON
    const body: unknown = await req.json().catch(() => null);
    if (!isSubmitRequestBody(body)) {
      return NextResponse.json({ error: 'invalid request body' }, { status: 400 });
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Account-ID": (body as any).account_id || "",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    const contentType = res.headers.get('content-type') || 'application/json';

    return new NextResponse(text, {
      status: res.status,
      headers: { 'Content-Type': contentType },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return new NextResponse(JSON.stringify({ error: 'proxy error', detail: msg }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }
}
