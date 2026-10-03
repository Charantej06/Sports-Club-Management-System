import { requireUser } from "@/lib/access";
import { ownedInvoice } from "@/modules/account/queries";
import { AppError, errorResponse } from "@/lib/errors";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(request);
    const { id } = await params;
    const invoice = await ownedInvoice(user.id, id);
    if (!invoice) throw new AppError(404, "NOT_FOUND", "Receipt not found.");
    return Response.json({ data: invoice });
  } catch (error) { return errorResponse(error); }
}
