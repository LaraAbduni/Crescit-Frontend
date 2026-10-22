import { webcrypto } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import { loadEnv } from "vite";

// Executa apenas o início do fluxo com o SDK instalado. Não usa credenciais,
// não envia um token e não troca o código de autorização por uma sessão.
const env = loadEnv("development", process.cwd(), "VITE_");
const origin = "http://localhost:5173";
const dom = new JSDOM("", { url: origin });
Object.defineProperty(dom.window, "crypto", { value: webcrypto });
Object.defineProperty(dom.window, "fetch", { value: globalThis.fetch.bind(globalThis) });
for (const key of ["window", "document", "navigator", "sessionStorage"]) {
  const value = key === "window" ? dom.window : dom.window[key];
  Object.defineProperty(globalThis, key, { value, configurable: true });
}

const { Auth0Client } = await import("@auth0/auth0-spa-js");
const client = new Auth0Client({
  domain: env.VITE_AUTH0_DOMAIN,
  clientId: env.VITE_AUTH0_CLIENT_ID,
  cacheLocation: "memory",
  authorizationParams: {
    redirect_uri: origin,
    audience: env.VITE_AUTH0_AUDIENCE,
    scope: "openid profile email",
  },
});

let authorizeUrl;
await client.loginWithRedirect({ openUrl: (url) => { authorizeUrl = url; } });
const url = new URL(authorizeUrl);
const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(15000) });
const location = response.headers.get("location");
const destination = location ? new URL(location, url) : undefined;
const report = {
  checkedAt: new Date().toISOString(),
  request: {
    host: url.host,
    client_id: url.searchParams.get("client_id"),
    redirect_uri: url.searchParams.get("redirect_uri"),
    audience: url.searchParams.get("audience"),
    scope: url.searchParams.get("scope"),
    response_type: url.searchParams.get("response_type"),
    code_challenge_method: url.searchParams.get("code_challenge_method"),
  },
  response: {
    status: response.status,
    destination: destination ? destination.origin + destination.pathname : null,
    error: destination?.searchParams.get("error") ?? null,
    description: destination?.searchParams.get("error_description") ?? null,
    requestId: response.headers.get("x-auth0-requestid") ?? response.headers.get("x-request-id"),
  },
};
// O relatório exclui cookies, state, nonce e o segredo PKCE da transação de teste.
await mkdir("dev/logs", { recursive: true });
await writeFile("dev/logs/auth0-diagnostic.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
dom.window.close();
if (report.response.error) process.exitCode = 1;
