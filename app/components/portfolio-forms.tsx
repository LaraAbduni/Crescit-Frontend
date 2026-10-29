import { useEffect, useState } from "react";
import { Chip, PrimaryButton, TextField } from "~/components/ui";
import { money, parseDecimal, todayISO } from "~/lib/format";
import { apiErrorMessage } from "~/lib/api";
import type { ContributionRequest, InvestmentRequest } from "~/lib/portfolio";
import { ASSET_TYPE_LABEL, getAssets, type Asset, type AssetType } from "~/lib/recommendations";

interface ContributionValues {
  quantity: string;
  unitPrice: string;
  date: string;
}

type ContributionErrors = Partial<Record<keyof ContributionValues, string>>;

// Mesmas regras do ContributionRequest: quantidade e preço > 0, data não futura
function validateContribution(v: ContributionValues): ContributionErrors {
  const errors: ContributionErrors = {};
  if (!(parseDecimal(v.quantity) > 0)) errors.quantity = "Informe uma quantidade maior que zero";
  if (!(parseDecimal(v.unitPrice) > 0)) errors.unitPrice = "Informe um preço maior que zero";
  if (!v.date) errors.date = "Informe a data";
  else if (v.date > todayISO()) errors.date = "A data não pode ser no futuro";
  return errors;
}

function toRequest(v: ContributionValues): ContributionRequest {
  return { quantity: parseDecimal(v.quantity), unitPrice: parseDecimal(v.unitPrice), contributionDate: v.date };
}

/** "131.2" -> "131,20" para preencher o campo de preço */
const priceInput = (price?: number) => (price ? price.toFixed(2).replace(".", ",") : "");

function ContributionFields({
  values,
  errors,
  onChange,
}: {
  values: ContributionValues;
  errors: ContributionErrors;
  onChange: (v: ContributionValues) => void;
}) {
  const total = parseDecimal(values.quantity) * parseDecimal(values.unitPrice);
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <TextField
          label="Quantidade"
          inputMode="decimal"
          placeholder="10"
          value={values.quantity}
          onChange={(e) => onChange({ ...values, quantity: e.target.value })}
          error={errors.quantity}
        />
        <TextField
          label="Preço unitário"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={values.unitPrice}
          onChange={(e) => onChange({ ...values, unitPrice: e.target.value })}
          error={errors.unitPrice}
        />
      </div>
      <TextField
        label="Data do aporte"
        type="date"
        max={todayISO()}
        value={values.date}
        onChange={(e) => onChange({ ...values, date: e.target.value })}
        error={errors.date}
      />
      <p className="flex justify-between rounded-2xl bg-white px-4 py-3 text-lg">
        <span className="text-muted">Total do aporte</span>
        <span className="font-semibold text-ink">{Number.isFinite(total) ? money(total) : "—"}</span>
      </p>
    </>
  );
}

function SubmitError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-aggressive/10 px-4 py-3 text-center text-aggressive">
      {message}
    </p>
  );
}

/** Confirmação de uma remoção (ativo ou aporte), com o erro da API no próprio painel. */
export function ConfirmRemoval({
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string>();

  async function handleConfirm() {
    setRemoving(true);
    setError(undefined);
    try {
      await onConfirm();
    } catch (e) {
      setError(apiErrorMessage(e, "Não foi possível remover. Tente de novo."));
      setRemoving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-lg text-ink/80">{message}</p>
      <SubmitError message={error} />
      <button
        type="button"
        onClick={handleConfirm}
        disabled={removing}
        className="h-14 w-full rounded-2xl bg-[#b4472f] text-lg font-semibold text-white transition hover:bg-[#963a26] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {removing ? "Removendo..." : confirmLabel}
      </button>
      <button type="button" onClick={onCancel} className="h-10 text-lg font-semibold text-brand hover:underline">
        Cancelar
      </button>
    </div>
  );
}

/** Novo aporte em um investimento que já está na carteira. */
export function ContributionForm({
  suggestedPrice,
  onSubmit,
}: {
  suggestedPrice?: number;
  onSubmit: (req: ContributionRequest) => Promise<void>;
}) {
  const [values, setValues] = useState<ContributionValues>({
    quantity: "",
    unitPrice: priceInput(suggestedPrice),
    date: todayISO(),
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const errors = submitted ? validateContribution(values) : {};

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validateContribution(values)).length) return;
    setSaving(true);
    setError(undefined);
    try {
      await onSubmit(toRequest(values));
    } catch (e) {
      setError(apiErrorMessage(e, "Não foi possível registrar o aporte. Tente de novo."));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <ContributionFields values={values} errors={errors} onChange={setValues} />
      <SubmitError message={error} />
      <PrimaryButton type="submit" disabled={saving}>
        {saving ? "Salvando..." : "Registrar aporte"}
      </PrimaryButton>
    </form>
  );
}

// Mesmas regras do InvestmentRequest
function validateInvestment(ticker: string, assetName: string, assetType?: AssetType) {
  const errors: { ticker?: string; assetName?: string; assetType?: string } = {};
  if (!/^[A-Z0-9.-]{1,20}$/.test(ticker)) errors.ticker = "Use só letras, números, ponto ou hífen";
  if (!assetName.trim()) errors.assetName = "Informe o nome do ativo";
  if (!assetType) errors.assetType = "Escolha o tipo";
  return errors;
}

/** Novo investimento já com o primeiro aporte. */
export function InvestmentForm({
  onSubmit,
}: {
  onSubmit: (investment: InvestmentRequest, contribution: ContributionRequest) => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<Asset[]>([]);
  const [ticker, setTicker] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>();
  const [values, setValues] = useState<ContributionValues>({ quantity: "", unitPrice: "", date: todayISO() });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    getAssets()
      .then(setCatalog)
      .catch(() => {});
  }, []);

  // Ticker conhecido: preenche nome, tipo e preço atual
  function handleTicker(value: string) {
    const t = value.toUpperCase().replace(/\s/g, "");
    setTicker(t);
    const asset = catalog.find((a) => a.ticker === t);
    if (asset) {
      setAssetName(asset.name);
      setAssetType(asset.assetType);
      setValues((v) => ({ ...v, unitPrice: v.unitPrice || priceInput(asset.currentPrice) }));
    }
  }

  const errors = submitted ? validateInvestment(ticker, assetName, assetType) : {};
  const contributionErrors = submitted ? validateContribution(values) : {};

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const invalid =
      Object.keys(validateInvestment(ticker, assetName, assetType)).length > 0 ||
      Object.keys(validateContribution(values)).length > 0;
    if (invalid) return;
    setSaving(true);
    setError(undefined);
    try {
      await onSubmit({ ticker, assetName: assetName.trim(), assetType: assetType! }, toRequest(values));
    } catch (e) {
      setError(apiErrorMessage(e, "Não foi possível adicionar o investimento. Tente de novo."));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <TextField
        label="Ticker"
        placeholder="BOVA11"
        autoCapitalize="characters"
        list="asset-catalog"
        value={ticker}
        onChange={(e) => handleTicker(e.target.value)}
        error={errors.ticker}
      />
      <datalist id="asset-catalog">
        {catalog.map((a) => (
          <option key={a.ticker} value={a.ticker}>
            {a.name}
          </option>
        ))}
      </datalist>
      <TextField
        label="Nome do ativo"
        placeholder="iShares Ibovespa"
        value={assetName}
        onChange={(e) => setAssetName(e.target.value)}
        error={errors.assetName}
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium text-ink">Tipo</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ASSET_TYPE_LABEL) as AssetType[]).map((t) => (
            <Chip key={t} selected={assetType === t} onClick={() => setAssetType(t)}>
              {ASSET_TYPE_LABEL[t]}
            </Chip>
          ))}
        </div>
        {errors.assetType && <span className="text-sm text-aggressive">{errors.assetType}</span>}
      </fieldset>

      <h3 className="mt-2 text-sm font-semibold uppercase tracking-[0.1em] text-muted">Primeiro aporte</h3>
      <ContributionFields values={values} errors={contributionErrors} onChange={setValues} />
      <SubmitError message={error} />
      <PrimaryButton type="submit" disabled={saving}>
        {saving ? "Salvando..." : "Adicionar investimento"}
      </PrimaryButton>
    </form>
  );
}
