import { useCallback, useEffect, useState } from "react";
import { loadPortfolio, type PortfolioSummary } from "./portfolio";
import { apiErrorMessage } from "./api";

export type PortfolioLoad =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; summary: PortfolioSummary; refreshError?: string };

/** Carrega o resumo da carteira; `reload` recarrega sem esconder os dados atuais. */
export function usePortfolio(userId: string) {
  const [load, setLoad] = useState<PortfolioLoad>({ status: "loading" });

  const reload = useCallback(async () => {
    try {
      setLoad({ status: "done", summary: await loadPortfolio(userId) });
    } catch (e) {
      const message = apiErrorMessage(e, "Não foi possível carregar sua carteira.");
      setLoad((current) => current.status === "done" ? { ...current, refreshError: message } : { status: "error", message });
    }
  }, [userId]);

  const retry = useCallback(() => {
    setLoad({ status: "loading" });
    void reload();
  }, [reload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { load, reload, retry };
}
