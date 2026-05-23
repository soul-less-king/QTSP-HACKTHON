import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function created<T>(data: T) {
  return NextResponse.json(data, { status: 201 });
}

interface ErrorDetails {
  field?: string;
  value?: unknown;
  reason?: string;
}

export function apiError(
  status: number,
  message: string,
  details?: ErrorDetails
) {
  return NextResponse.json(
    {
      error: true,
      status,
      message,
      details: details ?? null,
      timestamp: new Date().toISOString(),
      request_id: `req-${Math.random().toString(36).slice(2, 10)}`,
    },
    { status }
  );
}

export const unauthorized = (msg = "Unauthorized") => apiError(401, msg);
export const forbidden = (msg = "Forbidden") => apiError(403, msg);
export const notFound = (msg = "Not found") => apiError(404, msg);
export const badRequest = (msg: string, details?: ErrorDetails) =>
  apiError(400, msg, details);

export interface PaginationParams {
  page: number;
  limit: number;
}

export function parsePagination(url: URL): PaginationParams {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10))
  );
  return { page, limit };
}

export function paginated<T>(
  data: T[],
  total: number,
  { page, limit }: PaginationParams
) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return NextResponse.json(
    { pagination: { page, limit, total, total_pages: totalPages }, data },
    {
      headers: {
        "X-Total-Count": String(total),
        "X-Page": String(page),
        "X-Limit": String(limit),
        "X-Total-Pages": String(totalPages),
      },
    }
  );
}
