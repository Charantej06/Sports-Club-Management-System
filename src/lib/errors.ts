import { ZodError } from "zod";
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function errorResponse(error: unknown) {
  if (error instanceof AppError) return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  if (error instanceof ZodError) return Response.json({ error: { code: "VALIDATION", message: "Please check the highlighted fields.", fields: error.flatten().fieldErrors } }, { status: 422 });
  if (error instanceof SyntaxError) return Response.json({ error: { code: "INVALID_JSON", message: "Request must contain valid JSON." } }, { status: 400 });
  console.error("Request failed", error instanceof Error ? error.name : "unknown error");
  return Response.json({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, { status: 500 });
}
export function route(handler: (request: Request) => Promise<Response>) {
  return async (request: Request) => {
    let response: Response;
    try { response = await handler(request); } catch (error) { response = errorResponse(error); }
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const allowed = (process.env.TRUSTED_ORIGINS || process.env.BETTER_AUTH_URL || "http://localhost:3000").split(",");
  if (!origin || !allowed.includes(origin)) throw new AppError(403, "ORIGIN", "Request origin is not allowed.");
}
export async function jsonBody(request: Request) {
  const body = await request.text();
  if (body.length > 16384) throw new AppError(413, "TOO_LARGE", "Request is too large.");
  return JSON.parse(body) as unknown;
}
