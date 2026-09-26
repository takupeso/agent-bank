import { reset } from "@/features/demo/service";
import { checkRequest, failure } from "@/server/http";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    const principal = checkRequest(req)!;
    return Response.json(await reset(principal));
  } catch (e) {
    if (
      e instanceof Error &&
      [
        "Redeem all positions before reset",
        "Redeem all public principal before reset",
        "TD locks remain",
      ].includes(e.message)
    ) {
      return Response.json(
        {
          code: "OUTSTANDING_ASSETS",
          error:
            "運用中の資金または未確定の取引があるため、リセットできません。チャットで「運用分を全部TDに戻して」を実行し、償還完了後にもう一度リセットしてください。実行記録が「要確認」の場合は、その処理の確認が必要です。",
        },
        { status: 409 },
      );
    }
    if (e instanceof Error && e.message === "Another operation is active") {
      return Response.json(
        {
          code: "OPERATION_IN_PROGRESS",
          error:
            "処理中の取引があるため、リセットできません。処理の完了を待ってください。",
        },
        { status: 409 },
      );
    }
    return failure(e);
  }
}
