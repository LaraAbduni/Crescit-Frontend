import { Navigate, useNavigate } from "react-router";
import type { Route } from "./+types/profile-result";
import { PROFILE_TEXT_COLOR, ProfileGauge } from "~/components/profile-gauge";
import { Chip, PrimaryButton, Screen, TextButton } from "~/components/ui";
import { useOnboarding } from "~/lib/onboarding";
import { INVESTOR_TYPES, answerTags, isComplete } from "~/lib/profile";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Seu perfil · Crescit" }];
}

export default function ProfileResult() {
  const navigate = useNavigate();
  const { answers, profile, ready } = useOnboarding();

  if (!ready) return null;
  if (!profile) return <Navigate to="/perfil/questionario" replace />;

  const info = INVESTOR_TYPES[profile.investorType];
  const [lo, hi] = info.range;

  return (
    <Screen
      footer={
        <>
          <PrimaryButton onClick={() => navigate("/recomendacoes")}>Ver minhas recomendações</PrimaryButton>
          <TextButton onClick={() => navigate("/perfil/questionario?pergunta=1")}>Refazer questionário</TextButton>
        </>
      }
    >
      <div className="flex flex-col items-center text-center">
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.12em] text-muted">
          Seu perfil de investidor é
        </p>

        <div className="mt-10 w-full">
          <ProfileGauge type={profile.investorType} score={profile.score} />
        </div>

        <h1 className={`mt-8 font-serif text-6xl font-bold ${PROFILE_TEXT_COLOR[profile.investorType]}`}>
          {info.label}
        </h1>
        <p className="mt-2 text-lg text-muted">
          Score {profile.score} · faixa de {lo} a {hi} pontos
        </p>

        <p className="mt-6 max-w-sm text-xl leading-relaxed text-ink">{info.description}</p>

        {isComplete(answers) && (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {answerTags(answers).map((tag) => (
              <Chip key={tag}>{tag}</Chip>
            ))}
          </div>
        )}
      </div>
    </Screen>
  );
}
