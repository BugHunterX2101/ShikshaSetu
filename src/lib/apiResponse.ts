// src/lib/apiResponse.ts
// Standardized JSON response helpers and RFC 9457 Problem Details format

import { ProblemDetails } from '../store/types';

export function jsonOk(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function jsonError(
  code: string,
  messageEn: string,
  status = 400,
  extra: Record<string, unknown> = {}
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        messageEn,
        ...extra,
      },
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

export function jsonProblem(problem: ProblemDetails): Response {
  return new Response(JSON.stringify(problem), {
    status: problem.status,
    headers: {
      'Content-Type': 'application/problem+json',
    },
  });
}
