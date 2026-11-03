// Avisos de preço: lembrete para vender quando um ativo da carteira subir X%
// sobre o preço médio, ou para comprar quando um ativo cair X% sobre o preço
// do dia em que o aviso foi criado. Ficam neste navegador e são conferidos com
// os preços do catálogo (ainda sem cotação em tempo real).

import { useCallback, useEffect, useState } from "react";
import { getAssets, type AssetType } from "./recommendations";

export type AlertDirection = "sell-up" | "buy-down";

export interface PriceAlert {
  id: string;
  ticker: string;
  assetName: string;
  assetType: AssetType;
  direction: AlertDirection;
  /** Fração: 0.1 = 10% */
  percent: number;
  /** Preço de referência: preço médio (venda) ou preço do dia da criação (compra) */
  basePrice: number;
  /** yyyy-mm-dd */
  createdAt: string;
}

export interface AlertStatus {
  alert: PriceAlert;
  /** Ausente se o ativo não tem preço no catálogo */
  currentPrice?: number;
  /** Variação do preço atual sobre o de referência */
  change?: number;
  /** Preço que dispara o aviso */
  triggerPrice: number;
  triggered: boolean;
  /** Quanto do caminho até o gatilho já foi percorrido (0 a 1) */
  progress: number;
}

export const DIRECTION_LABEL: Record<AlertDirection, string> = {
  "sell-up": "Lembrete de venda",
  "buy-down": "Lista de compra",
};

export const PERCENT_OPTIONS = [0.05, 0.1, 0.15, 0.2];

export const alertsStorageKey = (userId: string) => `crescit:avisos:${userId}`;
const CHANGED_EVENT = "crescit:avisos-alterados";

export function triggerPrice(alert: Pick<PriceAlert, "direction" | "percent" | "basePrice">) {
  return alert.basePrice * (alert.direction === "sell-up" ? 1 + alert.percent : 1 - alert.percent);
}

export function evaluateAlert(alert: PriceAlert, currentPrice: number | undefined): AlertStatus {
  const trigger = triggerPrice(alert);
  if (currentPrice === undefined || !(alert.basePrice > 0)) {
    return { alert, triggerPrice: trigger, triggered: false, progress: 0 };
  }
  const change = currentPrice / alert.basePrice - 1;
  // Venda: avança quando sobe; compra: avança quando cai
  const moved = alert.direction === "sell-up" ? change : -change;
  return {
    alert,
    currentPrice,
    change,
    triggerPrice: trigger,
    triggered: moved >= alert.percent - 1e-9,
    progress: Math.min(Math.max(moved / alert.percent, 0), 1),
  };
}

/** Disparados primeiro; depois os mais perto do gatilho. */
export function sortStatuses(statuses: AlertStatus[]) {
  return [...statuses].sort((a, b) => Number(b.triggered) - Number(a.triggered) || b.progress - a.progress);
}

export function newAlertId() {
  return Math.random().toString(36).slice(2, 10);
}

function readAlerts(userId: string): PriceAlert[] {
  try {
    const saved = JSON.parse(localStorage.getItem(alertsStorageKey(userId)) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function writeAlerts(userId: string, alerts: PriceAlert[]) {
  try {
    localStorage.setItem(alertsStorageKey(userId), JSON.stringify(alerts));
  } catch {}
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGED_EVENT));
}

/**
 * Avisos da pessoa com a situação de cada um, pelos preços do catálogo.
 * Atualiza sozinho quando outra tela cria ou remove um aviso.
 */
export function usePriceAlerts(userId: string) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [prices, setPrices] = useState<Map<string, number>>();

  useEffect(() => {
    const refresh = () => setAlerts(readAlerts(userId));
    refresh();
    window.addEventListener(CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CHANGED_EVENT, refresh);
  }, [userId]);

  useEffect(() => {
    let active = true;
    getAssets()
      .then((assets) => active && setPrices(new Map(assets.filter((a) => a.active).map((a) => [a.ticker, a.currentPrice]))))
      .catch(() => active && setPrices(new Map()));
    return () => {
      active = false;
    };
  }, []);

  const statuses = prices ? sortStatuses(alerts.map((a) => evaluateAlert(a, prices.get(a.ticker)))) : [];
  const save = useCallback((next: PriceAlert[]) => writeAlerts(userId, next), [userId]);

  return { alerts, statuses, loaded: prices !== undefined, triggered: statuses.filter((s) => s.triggered), save };
}
