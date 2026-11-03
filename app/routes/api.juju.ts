import { askJuju, JujuError, parseChatRequest, verifyAccessToken } from "~/lib/juju-ai.server";
import type { Route } from "./+types/api.juju";

// POST /api/juju — recebe a conversa e o resumo da carteira e devolve a resposta da Juju
export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") return Response.json({ message: "Método não permitido." }, { status: 405 });
  try {
    await verifyAccessToken(request.headers.get("Authorization"));
    const body = await request.json().catch(() => null);
    const { messages, facts } = parseChatRequest(body);
    return Response.json(await askJuju(messages, facts), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof JujuError) return Response.json({ message: error.message }, { status: error.status });
    console.error("Juju: erro inesperado", error);
    return Response.json({ message: "A Juju não conseguiu responder agora." }, { status: 500 });
  }
}
