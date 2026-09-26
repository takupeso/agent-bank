import { reset } from "@/features/demo/service";
import { checkRequest, failure } from "@/server/http";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const principal = checkRequest(req)!;
    return Response.json(await reset(principal));
  } catch (e) {
    return failure(e);
  }
}
