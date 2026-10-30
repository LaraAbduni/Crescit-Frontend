import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import type { Route } from "./+types/signup-context";
import { Chip, Eyebrow, OptionCard, PrimaryButton, Screen, StepHeader, Title } from "~/components/ui";
import { INSTITUTIONS } from "~/lib/institutions";
import { useOnboarding } from "~/lib/onboarding";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Seu contexto · Crescit" }];
}

const BANKS = [...INSTITUTIONS, "Outro"];
const NO_ACCOUNT = "Nenhuma";

const MONTHLY_AMOUNTS = [
  { value: "ATE_500", label: "Até R$ 500" },
  { value: "500_2000", label: "De R$ 500 a R$ 2.000" },
  { value: "2000_5000", label: "De R$ 2.000 a R$ 5.000" },
  { value: "ACIMA_5000", label: "Mais de R$ 5.000" },
];

export default function SignupContext() {
  const navigate = useNavigate();
  const { account, context, profile, ready, setContext } = useOnboarding();
  const [banks, setBanks] = useState<string[]>([]);
  const [monthlyAmount, setMonthlyAmount] = useState<string>();

  useEffect(() => {
    if (ready && context) {
      setBanks(context.banks);
      setMonthlyAmount(context.monthlyAmount);
    }
  }, [ready]);

  if (ready && !account) return <Navigate to="/cadastro" replace />;
  if (ready && profile) return <Navigate to="/inicio" replace />;

  function toggleBank(bank: string) {
    setBanks((current) => {
      if (bank === NO_ACCOUNT) return current.includes(NO_ACCOUNT) ? [] : [NO_ACCOUNT];
      const without = current.filter((b) => b !== bank && b !== NO_ACCOUNT);
      return current.includes(bank) ? without : [...without, bank];
    });
  }

  function handleContinue() {
    setContext({ banks, monthlyAmount });
    navigate("/perfil/questionario");
  }

  const firstName = account?.name.split(" ")[0];

  return (
    <Screen
      header={<StepHeader label="Cadastro · 2 de 2" progress={1} onBack={() => navigate("/cadastro")} />}
      footer={
        <PrimaryButton onClick={handleContinue} disabled={banks.length === 0 || !monthlyAmount}>
          Continuar
        </PrimaryButton>
      }
    >
      <Eyebrow>Seu contexto</Eyebrow>
      <Title>{firstName ? `${firstName}, onde você tem conta hoje?` : "Onde você tem conta hoje?"}</Title>
      <p className="mt-3 text-muted">Bancos e corretoras. Pode marcar mais de um.</p>
      <p className="mt-2 text-sm text-muted">Essas preferências ficam salvas neste navegador.</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {BANKS.map((bank) => (
          <Chip key={bank} selected={banks.includes(bank)} onClick={() => toggleBank(bank)}>
            {bank}
          </Chip>
        ))}
        <Chip selected={banks.includes(NO_ACCOUNT)} onClick={() => toggleBank(NO_ACCOUNT)}>
          Não tenho conta
        </Chip>
      </div>

      <h2 className="mt-10 font-serif text-2xl font-bold text-ink">Quanto pretende investir por mês?</h2>
      <div className="mt-4 flex flex-col gap-3" role="radiogroup">
        {MONTHLY_AMOUNTS.map((option) => (
          <OptionCard
            key={option.value}
            label={option.label}
            selected={monthlyAmount === option.value}
            onSelect={() => setMonthlyAmount(option.value)}
          />
        ))}
      </div>
    </Screen>
  );
}
