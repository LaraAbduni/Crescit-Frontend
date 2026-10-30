import { useEffect, useState } from "react";
import { Chip, PrimaryButton, TextField } from "~/components/ui";
import { money, parseDecimal, todayISO } from "~/lib/format";
import { apiErrorMessage } from "~/lib/api";
import { RATE_TYPE_LABEL, type RateType } from "~/lib/fixed-income";
import { INSTITUTIONS } from "~/lib/institutions";
import { generatedTicker, type ContributionRequest, type InvestmentRequest } from "~/lib/portfolio";
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

// Renda fixa e fundos: a pessoa informa só o valor aplicado. Para a API, o
// aporte vira quantidade 1 × valor, e a conta do backend continua a mesma.
interface AmountValues {
  amount: string;
  date: string;
}

type AmountErrors = Partial<Record<keyof AmountValues, string>>;

function validateAmount(v: AmountValues): AmountErrors {
  const errors: AmountErrors = {};
  if (!(parseDecimal(v.amount) > 0)) errors.amount = "Informe um valor maior que zero";
  if (!v.date) errors.date = "Informe a data";
  else if (v.date > todayISO()) errors.date = "A data não pode ser no futuro";
  return errors;
}

const amountToRequest = (v: AmountValues): ContributionRequest => ({
  quantity: 1,
  unitPrice: parseDecimal(v.amount),
  contributionDate: v.date,
});

function AmountFields({
  values,
  errors,
  onChange,
}: {
  values: AmountValues;
  errors: AmountErrors;
  onChange: (v: AmountValues) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <TextField
        label="Valor aplicado"
        inputMode="decimal"
        placeholder="R$ 0,00"
        value={values.amount}
        onChange={(e) => onChange({ ...values, amount: e.target.value })}
        error={errors.amount}
      />
      <TextField
        label="Data"
        type="date"
        max={todayISO()}
        value={values.date}
        onChange={(e) => onChange({ ...values, date: e.target.value })}
        error={errors.date}
      />
    </div>
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
  amountBased = false,
  onSubmit,
}: {
  suggestedPrice?: number;
  /** Renda fixa e fundos: pede só o valor aplicado */
  amountBased?: boolean;
  onSubmit: (req: ContributionRequest) => Promise<void>;
}) {
  const [values, setValues] = useState<ContributionValues>({
    quantity: "",
    unitPrice: priceInput(suggestedPrice),
    date: todayISO(),
  });
  const [amount, setAmount] = useState<AmountValues>({ amount: "", date: todayISO() });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const errors = submitted && !amountBased ? validateContribution(values) : {};
  const amountErrors = submitted && amountBased ? validateAmount(amount) : {};

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const invalid = amountBased ? validateAmount(amount) : validateContribution(values);
    if (Object.keys(invalid).length) return;
    setSaving(true);
    setError(undefined);
    try {
      await onSubmit(amountBased ? amountToRequest(amount) : toRequest(values));
    } catch (e) {
      setError(apiErrorMessage(e, "Não foi possível registrar o aporte. Tente de novo."));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {amountBased ? (
        <AmountFields values={amount} errors={amountErrors} onChange={setAmount} />
      ) : (
        <ContributionFields values={values} errors={errors} onChange={setValues} />
      )}
      <SubmitError message={error} />
      <PrimaryButton type="submit" disabled={saving}>
        {saving ? "Salvando..." : "Registrar aporte"}
      </PrimaryButton>
    </form>
  );
}

/** O que a pessoa está cadastrando; decide quais campos aparecem. */
type Kind = "market" | "fixed" | "fund";

const KIND_LABEL: Record<Kind, string> = {
  market: "Ação, FII ou ETF",
  fixed: "Renda fixa",
  fund: "Fundo",
};

const KIND_HINT: Record<Kind, string> = {
  market: "Ativos negociados na bolsa, com ticker.",
  fixed: "CDB, LCI, LCA, Tesouro Direto, debêntures...",
  fund: "Fundos de investimento: multimercado, renda fixa, ações...",
};

const MARKET_TYPES: AssetType[] = ["STOCK", "FII", "ETF"];

const RATE_PLACEHOLDER: Record<RateType, string> = {
  CDI_PERCENT: "110",
  PREFIXED: "12,5",
  IPCA_PLUS: "6",
};

const RATE_SUFFIX: Record<RateType, string> = {
  CDI_PERCENT: "% do CDI",
  PREFIXED: "% ao ano",
  IPCA_PLUS: "% ao ano + IPCA",
};

type InvestmentErrors = Partial<Record<"institution" | "ticker" | "assetName" | "assetType" | "rateValue", string>>;

/** Novo investimento já com o primeiro aporte. */
export function InvestmentForm({
  preferredInstitutions = [],
  initialInstitution = "",
  onSubmit,
}: {
  /** Instituições que a pessoa já usa (cadastro e carteira), mostradas primeiro */
  preferredInstitutions?: string[];
  /** Já vem marcada (ex.: "Adicionar no BTG Pactual") */
  initialInstitution?: string;
  onSubmit: (investment: InvestmentRequest, contribution: ContributionRequest) => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<Asset[]>([]);
  const [institution, setInstitution] = useState(initialInstitution);
  const [otherInstitution, setOtherInstitution] = useState(false);
  const [kind, setKind] = useState<Kind>("market");
  const [ticker, setTicker] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<AssetType>();
  const [rateType, setRateType] = useState<RateType>("CDI_PERCENT");
  const [rateValue, setRateValue] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [values, setValues] = useState<ContributionValues>({ quantity: "", unitPrice: "", date: todayISO() });
  const [amount, setAmount] = useState<AmountValues>({ amount: "", date: todayISO() });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    getAssets()
      .then(setCatalog)
      .catch(() => {});
  }, []);

  const institutionOptions = [...new Set([...preferredInstitutions, ...INSTITUTIONS, ...(initialInstitution ? [initialInstitution] : [])])];

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

  function validate(): InvestmentErrors {
    const errors: InvestmentErrors = {};
    if (!institution.trim()) errors.institution = "Escolha onde está esse investimento";
    if (!assetName.trim()) errors.assetName = kind === "market" ? "Informe o nome do ativo" : "Dê um nome para reconhecer este investimento";
    if (kind === "market") {
      if (!/^[A-Z0-9.-]{1,20}$/.test(ticker)) errors.ticker = "Use só letras, números, ponto ou hífen";
      if (!assetType) errors.assetType = "Escolha o tipo";
    }
    if (kind === "fixed" && rateValue.trim() && !(parseDecimal(rateValue) > 0)) errors.rateValue = "Informe uma taxa maior que zero";
    return errors;
  }

  const errors = submitted ? validate() : {};
  const contributionErrors = submitted && kind === "market" ? validateContribution(values) : {};
  const amountErrors = submitted && kind !== "market" ? validateAmount(amount) : {};

  function buildInvestment(): InvestmentRequest {
    const base = { assetName: assetName.trim(), institution: institution.trim() };
    if (kind === "market") return { ...base, ticker, assetType: assetType! };
    if (kind === "fund") return { ...base, ticker: generatedTicker("FUND"), assetType: "FUND" };
    const rate = parseDecimal(rateValue);
    return {
      ...base,
      ticker: generatedTicker("FIXED_INCOME"),
      assetType: "FIXED_INCOME",
      ...(rate > 0 ? { rateType, rateValue: rate } : {}),
      ...(maturityDate ? { maturityDate } : {}),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    const contributionInvalid = kind === "market" ? validateContribution(values) : validateAmount(amount);
    if (Object.keys(validate()).length > 0 || Object.keys(contributionInvalid).length > 0) return;
    setSaving(true);
    setError(undefined);
    try {
      await onSubmit(buildInvestment(), kind === "market" ? toRequest(values) : amountToRequest(amount));
    } catch (e) {
      setError(apiErrorMessage(e, "Não foi possível adicionar o investimento. Tente de novo."));
      setSaving(false);
    }
  }

  // Tipo vindo do catálogo que não está entre os da bolsa (ex.: Tesouro) também aparece
  const marketTypes = assetType && !MARKET_TYPES.includes(assetType) ? [...MARKET_TYPES, assetType] : MARKET_TYPES;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium text-ink">Onde está esse investimento?</legend>
        <div className="flex flex-wrap gap-2">
          {institutionOptions.map((name) => (
            <Chip
              key={name}
              selected={!otherInstitution && institution === name}
              onClick={() => {
                setOtherInstitution(false);
                setInstitution(name);
              }}
            >
              {name}
            </Chip>
          ))}
          <Chip
            selected={otherInstitution}
            onClick={() => {
              setOtherInstitution(true);
              setInstitution("");
            }}
          >
            Outra
          </Chip>
        </div>
        {otherInstitution && (
          <div className="mt-2">
            <TextField
              label="Nome da instituição"
              placeholder="Banco, corretora..."
              maxLength={60}
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />
          </div>
        )}
        {errors.institution && <span className="text-sm text-aggressive">{errors.institution}</span>}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium text-ink">O que é?</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>
              {KIND_LABEL[k]}
            </Chip>
          ))}
        </div>
        <span className="text-sm text-muted">{KIND_HINT[kind]}</span>
      </fieldset>

      {kind === "market" && (
        <>
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
              {marketTypes.map((t) => (
                <Chip key={t} selected={assetType === t} onClick={() => setAssetType(t)}>
                  {ASSET_TYPE_LABEL[t]}
                </Chip>
              ))}
            </div>
            {errors.assetType && <span className="text-sm text-aggressive">{errors.assetType}</span>}
          </fieldset>

          <h3 className="mt-2 text-sm font-semibold uppercase tracking-[0.1em] text-muted">Primeiro aporte</h3>
          <ContributionFields values={values} errors={contributionErrors} onChange={setValues} />
        </>
      )}

      {kind === "fixed" && (
        <>
          <TextField
            label="Nome"
            placeholder="CDB Inter 110% CDI"
            maxLength={255}
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
            error={errors.assetName}
          />
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 font-medium text-ink">Rentabilidade contratada</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(RATE_TYPE_LABEL) as RateType[]).map((t) => (
                <Chip key={t} selected={rateType === t} onClick={() => setRateType(t)}>
                  {RATE_TYPE_LABEL[t]}
                </Chip>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label={`Taxa (${RATE_SUFFIX[rateType]})`}
              inputMode="decimal"
              placeholder={RATE_PLACEHOLDER[rateType]}
              value={rateValue}
              onChange={(e) => setRateValue(e.target.value)}
              error={errors.rateValue}
            />
            <TextField
              label="Vencimento (opcional)"
              type="date"
              value={maturityDate}
              onChange={(e) => setMaturityDate(e.target.value)}
            />
          </div>
          <p className="-mt-2 text-sm text-muted">Com a taxa, estimamos quanto o investimento rendeu até hoje.</p>

          <h3 className="mt-2 text-sm font-semibold uppercase tracking-[0.1em] text-muted">Aplicação</h3>
          <AmountFields values={amount} errors={amountErrors} onChange={setAmount} />
        </>
      )}

      {kind === "fund" && (
        <>
          <TextField
            label="Nome do fundo"
            placeholder="Itaú Multimercado"
            maxLength={255}
            value={assetName}
            onChange={(e) => setAssetName(e.target.value)}
            error={errors.assetName}
          />
          <h3 className="mt-2 text-sm font-semibold uppercase tracking-[0.1em] text-muted">Aplicação</h3>
          <AmountFields values={amount} errors={amountErrors} onChange={setAmount} />
        </>
      )}

      <SubmitError message={error} />
      <PrimaryButton type="submit" disabled={saving}>
        {saving ? "Salvando..." : "Adicionar investimento"}
      </PrimaryButton>
    </form>
  );
}
