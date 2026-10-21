import { useCallback, useEffect, useState } from "react";
import { loadPortfolio, type PortfolioSummary } from "./portfolio";

export type PortfolioLoad =
  | { status: "loading" }
  | { status: "error" }
  | { status: "done"; summary: PortfolioSummary };

/** Carrega o resumo da carteira; `reload` recarrega sem esconder os dados atuais. */
export function usePortfolio(userId: string) {
  const [load, setLoad] = useState<PortfolioLoad>({ status: "loading" });

  const reload = useCallback(async () => {
    try {
      setLoad({ status: "done", summary: await loadPortfolio(userId) });
    } catch {
      setLoad((current) => (current.status === "done" ? current : { status: "error" }));
    }
  }, [userId]);

  const retry = useCallback(() => {
    setLoad({ status: "loading" });
    reload();
  }, [reload]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { load, reload, retry };
}
