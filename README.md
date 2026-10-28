# Crescit — frontend e ambiente local

React Router, React 19 e Tailwind, com o padrão visual original do Crescit. As telas usam as APIs de Perfil, Recomendações e Portfólio com access tokens do Auth0.

## APIs em producao

O servidor atual e `100.53.222.83`. As tres APIs usam o proxy HTTPS na porta
8081, que ja estava liberada na EC2:

```env
VITE_PROFILE_API_URL=https://perfil.100-53-222-83.sslip.io:8081
VITE_RECOMMENDATIONS_API_URL=https://recomendacoes.100-53-222-83.sslip.io:8081
VITE_PORTFOLIO_API_URL=https://portfolio.100-53-222-83.sslip.io:8081
```

Esses valores devem estar no ambiente Production da Vercel; alteracoes exigem
um novo deploy. `.env.production` contem os mesmos valores publicos para builds
de producao locais. O desenvolvimento local continua usando `.env`.

Os enderecos temporarios usam sslip.io e dependem do IP atual da instancia.
O Caddy renova os certificados automaticamente pela porta 80. Se o IP mudar,
atualize os hosts do proxy e as variaveis da Vercel.

## Estado da configuração Auth0

Em 22/10/2026, a API foi substituída pela audience `https://api.crescit-investimentos`. O frontend e os três serviços locais já usam essa nova audience. Foi corrigida uma falha de sincronização que mostrava sessão expirada antes de obter o token. Após configurar o RBAC e os vínculos de permissões da API nova no Auth0, o usuário confirmou que conseguiu entrar e abrir o app sem o bloqueio de acesso ao perfil. O percurso completo de salvar o questionário, consultar recomendações e registrar investimentos e aportes ainda precisa ser validado com essa conta no navegador.

No tenant `dev-s41b58hqkvvmdu13.us.auth0.com`, confira:

1. Em **Applications → APIs**, a API deve ter o **Identifier** exatamente igual a `https://api.crescit-investimentos`, com assinatura **RS256**. Esse Identifier é compartilhado pelos três serviços; não é necessário que seja um site publicado.
2. Na API, habilite **Enable RBAC** e **Add Permissions in the Access Token**.
3. A conta de teste precisa ter as permissões abaixo, por meio do papel de usuário já usado pelo projeto:

| Serviço | Permissões da conta |
| --- | --- |
| Perfil | `read:profile`, `write:profile` |
| Recomendações | `read:recommendations`, `write:recommendations`, `read:assets` |
| Portfólio | `read:portfolio`, `write:portfolio` |

`write:assets` é administrativa e não é necessária para o fluxo do investidor.

A aplicação SPA deve estar autorizada na API nova para **User-Delegated Access**. Com a política **Per-app authorization**, isso é feito em **Application Access → Edit**, selecionando o client ID abaixo e as permissões necessárias. As permissões do papel da conta também precisam pertencer à API nova; as cadastradas na API antiga não se transferem automaticamente. [Guia oficial de políticas de acesso](https://auth0.com/blog/developers-guide-api-access-policies-auth0/).

Na aplicação SPA de client ID `eNZRW1uJ0SaV5kvC2cjRM8g9s4DqbnSc`, configure **Allowed Callback URLs**, **Allowed Logout URLs** e **Allowed Web Origins** com `http://localhost:5173`. Use esse endereço no navegador, mantendo o host e a porta.

O login solicita exatamente `openid profile email` e a audience configurada. As permissões das APIs vêm no claim `permissions`; os escopos de identidade sozinhos não concedem acesso aos dados.

Referências oficiais: [SDK React](https://github.com/auth0/auth0-react), [audience e Identifier](https://support.auth0.com/center/s/article/value-of-the-audience-attribute-in-access-token-requests-and-its-significance) e [RBAC no Spring](https://developer.auth0.com/resources/code-samples/api/spring/basic-role-based-access-control).

## Rodar

Requisitos: Docker Desktop ativo e Node compatível com Vite 8 (22.12+ ou 24+). O build Java acontece dentro do Docker; não é necessário instalar Maven ou Java para iniciar o ambiente.

A pasta acima deste repositório contém `compose.yaml` e os scripts do ambiente completo. Com os quatro repositórios de Crescit presentes como nesta workspace, execute nessa pasta:

```powershell
.\start-local.ps1
```

O script cria `Crescit-Frontend/.env` a partir do exemplo apenas se ele ainda não existir, inicia a infraestrutura e as APIs, instala as dependências se necessário e inicia o frontend.

Ou execute manualmente:

```powershell
# Na pasta que contém compose.yaml:
docker compose up -d --build --wait --wait-timeout 240
cd Crescit-Frontend

# Apenas se ainda não houver .env:
Copy-Item .env.example .env

npm ci
npm run dev
```

| Serviço | Endereço |
| --- | --- |
| Frontend | http://localhost:5173 |
| Perfil | http://localhost:8081 |
| Recomendações | http://localhost:8082 |
| Portfólio | http://localhost:8083 |
| RabbitMQ (administração local) | http://localhost:15672 |

O PostgreSQL deste ambiente só é acessível na rede interna do Docker e usa um banco para cada serviço. Ele não utiliza o PostgreSQL de outros projetos na porta 5432. O RabbitMQ local usa usuário `crescit` e senha `crescit-local`; são credenciais exclusivas de desenvolvimento.

Perfis, investimentos e aportes persistem nos volumes do Docker. O catálogo local é inicializado com nove ativos e preços ilustrativos fixos; não há integração com cotações de mercado em tempo real. Reiniciar o ambiente preserva esses registros.

## Configuração do frontend

O arquivo `.env.example` contém os identificadores públicos do Auth0 e as três URLs locais. Nunca coloque `client_secret`, senhas ou tokens em variáveis `VITE_*`.

Depois de alterar o `.env`, pare e inicie o frontend novamente. Ao publicar os backends, atualize também qualquer variável externa `AUTH0_AUDIENCE` para `https://api.crescit-investimentos`: valores definidos no ambiente ou no GitHub Actions prevalecem sobre o padrão dos arquivos do projeto.

O SDK oficial controla Authorization Code + PKCE e mantém os tokens em memória. O app obtém um access token antes de cada chamada; nunca envia uma chamada de negócio sem `Authorization: Bearer ACCESS_TOKEN`. Não há fallback automático para dados de demonstração.

As rotas de dados exigem login. O perfil é recuperado do backend usando o `sub` do usuário; um `404` inicia o onboarding, enquanto erros de rede ou de permissão são mostrados para permitir nova tentativa. Sessões expiradas pedem novo login sem repetir escritas automaticamente.

Os rascunhos de respostas e preferências são separados por `sub` no sessionStorage e removidos ao sair. Bancos, valor mensal pretendido, renda e patrimônio ainda não fazem parte do contrato de persistência das APIs: ficam apenas na sessão. O questionário envia os cinco campos suportados pelo serviço de Perfil. Nome e e-mail vêm do Auth0.

## Testar no navegador

Com o ambiente iniciado:

1. Abra http://localhost:5173 e escolha **Criar minha conta** ou **Já tenho conta**. O formulário de acesso é o Universal Login do Auth0.
2. Entre com uma conta com as permissões indicadas acima.
3. No primeiro acesso, preencha o contexto e as sete perguntas. Confira o perfil calculado pelo backend.
4. Abra **Recomendações**, filtre por tipo e adicione um ativo à carteira.
5. Em **Carteira**, abra o ativo e registre um aporte. Também é possível criar um investimento manualmente com seu primeiro aporte.
6. Confira os totais no **Início**, atualize a página e verifique a persistência.
7. Refaça o questionário e verifique a atualização do perfil e das recomendações.
8. Use **Sair**, entre novamente e confira a recuperação do perfil. Uma segunda conta deve ter carteira e rascunho próprios.

Se houver `403` ao carregar o perfil, a primeira permissão exigida é `read:profile`. Em **User Management → Roles → papel de investidor → Permissions**, adicione as sete permissões da tabela selecionando a API nova. Em **User Management → Users → conta de teste → Roles**, confira se o papel está atribuído à conta. Confirme também os dois controles de RBAC na API nova. Depois, use **Sair da conta** e entre novamente para obter um token atualizado; apenas tentar novamente pode reutilizar o token antigo. [Guia oficial para permissões ausentes no token](https://auth0.com/blog/five-reasons-permissions-not-in-access-token/).

Se o Auth0 disser que o client não está autorizado, confira **User-Delegated Access**. Se aparecer `Service not found`, confirme o Identifier da API e reinicie o frontend depois de ajustar o `.env`.

## Validação

Para conferir a configuração efetivamente usada e repetir o início do login com o SDK oficial instalado:

```powershell
npm run diagnose:auth
```

Esse diagnóstico carrega o ambiente de desenvolvimento, gera a URL de autorização pelo SDK e consulta a resposta inicial do Auth0. Ele não faz login nem troca tokens. O relatório sanitizado fica em `dev/logs/auth0-diagnostic.json`, com os parâmetros públicos enviados, o erro devolvido e o request ID para localizar a tentativa no Auth0. Não inclui cookies, state, nonce ou o segredo PKCE.

Na verificação de 22/10/2026 às 10:28 (São Paulo), a requisição gerada pelo SDK com a nova audience, `openid profile email` e PKCE recebeu HTTP 302 para `/u/login`, sem erro (request ID `eee673156e981b89f028`). O Vite foi reiniciado e a audience servida foi conferida por HTTP; os três contêineres também foram reconstruídos e usam a mesma configuração. Esse resultado confirma o início da autorização, mas não comprova a conclusão do login nem as chamadas autenticadas com uma conta real.

```powershell
npm test
npm run typecheck
npm run build
```

Os testes do frontend verificam configuração do SDK, disponibilidade do token ao retornar do login, envio de tokens, 401/403, recuperação e isolamento dos usuários, conflito de questionário, recomendações e composição da carteira. Eles usam transportes simulados e não substituem o teste de login real.

Os backends mantêm suas suítes Maven. Nesta integração, a base passou nos 179 testes existentes; o frontend passou em 31 testes, TypeScript e build. A infraestrutura local também foi verificada por HTTP, incluindo autenticação obrigatória e CORS.

## Parar e consultar logs

No terminal do frontend, use Ctrl+C. Na pasta do compose:

```powershell
.\stop-local.ps1
docker compose ps
docker compose logs --tail 100 profile recommendations portfolio
```

O script de parada preserva os volumes e os dados. O frontend iniciado em segundo plano nesta sessão tem seus logs em `Crescit-Frontend/dev/logs/`; o script de parada também reconhece esse processo pelo arquivo de controle gerado pela sessão.
