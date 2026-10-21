import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router";
import type { Route } from "./+types/questionnaire";
import { Eyebrow, OptionCard, PrimaryButton, Screen, StepHeader, Title } from "~/components/ui";
import { ApiError } from "~/lib/api";
import { saveQuestionnaire } from "~/lib/profile-api";
import { useOnboarding } from "~/lib/onboarding";
import { QUESTIONS, isAnswered, isComplete, toQuestionnaireRequest, type QuestionOption } from "~/lib/profile";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Perfil de investidor · Crescit" }];
}

export default function Questionnaire() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { account, answers, profile, ready, setAnswers, setProfile } = useOnboarding();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  if (ready && !account) return <Navigate to="/cadastro" replace />;

  const total = QUESTIONS.length;
  const step = Math.min(Math.max(Number(params.get("pergunta")) || 1, 1), total);
  const question = QUESTIONS[step - 1];
  const current = answers[question.id];
  const selected = Array.isArray(current) ? current : current !== undefined ? [current] : [];
  const isLast = step === total;

  function goTo(n: number) {
    setError(undefined);
    setParams({ pergunta: String(n) });
  }

  function handleBack() {
    if (step > 1) goTo(step - 1);
    else navigate(profile ? "/perfil/resultado" : "/cadastro/contexto");
  }

  function handleSelect(option: QuestionOption) {
    if (!question.multiple) return setAnswers({ ...answers, [question.id]: option.value });
    // Opção exclusiva ("Nunca investi") desmarca as outras, e vice-versa
    const exclusive = question.options.filter((o) => o.exclusive).map((o) => o.value);
    const next = selected.includes(option.value)
      ? selected.filter((v) => v !== option.value)
      : option.exclusive
        ? [option.value]
        : [...selected.filter((v) => !exclusive.includes(v)), option.value];
    setAnswers({ ...answers, [question.id]: next });
  }

  async function handleContinue() {
    if (!isLast) return goTo(step + 1);
    if (!isComplete(answers)) {
      // Volta para a primeira pergunta sem resposta
      const missing = QUESTIONS.findIndex((q) => !isAnswered(q, answers));
      return goTo(missing + 1);
    }
    setSubmitting(true);
    setError(undefined);
    try {
      const result = await saveQuestionnaire(toQuestionnaireRequest(answers), !!profile);
      setProfile(result);
      navigate("/perfil/resultado");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      header={<StepHeader label={`Pergunta ${step} de ${total}`} progress={step / total} onBack={handleBack} />}
      footer={
        <>
          {error && (
            <p role="alert" className="rounded-xl bg-aggressive/10 px-4 py-3 text-center text-aggressive">
              {error}
            </p>
          )}
          <PrimaryButton onClick={handleContinue} disabled={!isAnswered(question, answers) || submitting}>
            {submitting ? "Calculando seu perfil..." : isLast ? "Ver meu perfil" : "Continuar"}
          </PrimaryButton>
        </>
      }
    >
      <Eyebrow>{question.eyebrow}</Eyebrow>
      <Title>{question.title}</Title>
      {question.hint && <p className="mt-3 text-muted">{question.hint}</p>}

      <div
        key={question.id}
        className="mt-8 flex flex-col gap-4"
        role={question.multiple ? "group" : "radiogroup"}
        aria-label={question.title}
      >
        {question.options.map((option) => (
          <OptionCard
            key={option.value}
            label={option.label}
            description={option.description}
            multiple={question.multiple}
            selected={selected.includes(option.value)}
            onSelect={() => handleSelect(option)}
          />
        ))}
      </div>
    </Screen>
  );
}

function errorMessage(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 401) return "Sua sessão expirou. Entre novamente.";
    if (e.status === 403) return "Você não tem permissão para salvar o perfil.";
    if (e.status === 400) return "Faltou responder alguma pergunta.";
  }
  return "Não foi possível salvar suas respostas. Tente de novo.";
}
