import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import type { Route } from "./+types/signup";
import { Eyebrow, PrimaryButton, Screen, StepHeader, TextField, Title } from "~/components/ui";
import { useOnboarding } from "~/lib/onboarding";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Criar conta · Crescit" }];
}

interface Errors {
  name?: string;
  email?: string;
  password?: string;
}

function validate(name: string, email: string, password: string): Errors {
  const errors: Errors = {};
  if (name.trim().split(/\s+/).length < 2) errors.name = "Informe nome e sobrenome";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "E-mail inválido";
  if (password.length < 8) errors.password = "A senha precisa ter pelo menos 8 caracteres";
  return errors;
}

export default function Signup() {
  const navigate = useNavigate();
  const { account, ready, setAccount } = useOnboarding();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Preenche de novo quando o usuário volta para esta etapa
  useEffect(() => {
    if (ready && account) {
      setName(account.name);
      setEmail(account.email);
    }
  }, [ready]);

  const errors = submitted ? validate(name, email, password) : {};

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (Object.keys(validate(name, email, password)).length > 0) return;
    // TODO: criar o usuário no Auth0. A senha não é guardada no front.
    setAccount({ name: name.trim(), email: email.trim() });
    navigate("/cadastro/contexto");
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Screen
        header={<StepHeader label="Cadastro · 1 de 2" progress={0.5} onBack={() => navigate("/")} />}
        footer={<PrimaryButton type="submit">Continuar</PrimaryButton>}
      >
        <Eyebrow>Sua conta</Eyebrow>
        <Title>Vamos começar pelo básico</Title>
        <p className="mt-3 text-muted">Depois, algumas perguntas para conhecer você como investidor.</p>

        <div className="mt-8 flex flex-col gap-5">
          <TextField
            label="Nome completo"
            autoComplete="name"
            placeholder="Marina Souza"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
          />
          <TextField
            label="E-mail"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="voce@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />
          <TextField
            label="Senha"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo de 8 caracteres"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
          />
        </div>
      </Screen>
    </form>
  );
}
