# Controle de Ponto — Backend

API REST para sistema de controle de ponto eletrônico, desenvolvida com NestJS, Prisma e PostgreSQL.

## Tecnologias

- **NestJS** + TypeScript
- **Prisma ORM** + PostgreSQL
- **JWT** (access token 15min + refresh token 7d com rotação)
- **AES-256-CBC** para criptografia de CPF (LGPD)
- **Nodemailer** (Gmail App Password) para notificações por e-mail
- **Swagger** em `/api/docs`
- **Docker** + docker-compose

## Funcionalidades

- Cadastro e autenticação de empresas (com verificação de e-mail)
- Cadastro de funcionários com envio de convite por e-mail
- Gestão de cargos e permissões
- Registro de ponto (check-in / check-out) com detecção de atraso e hora extra
- Dashboard com métricas de presença, pontualidade e rankings
- Cron jobs: lembretes de entrada/saída e marcação de ausências
- Rate limiting, Helmet, CORS e validação global de DTOs

## Pré-requisitos

- Node.js 20+
- Docker e Docker Compose

## Configuração local

```bash
# 1. Copie e preencha as variáveis de ambiente
cp .env.example .env

# 2. Suba o banco e o Redis
docker compose up -d postgres redis

# 3. Instale as dependências
npm install

# 4. Rode as migrations
npx prisma migrate deploy

# 5. Inicie em modo desenvolvimento
npm run start:dev
```

A API estará disponível em `http://localhost:3000/api/v1`
Swagger em `http://localhost:3000/api/docs`

## Subir tudo com Docker

```bash
docker compose up -d
```

Serviços iniciados: `postgres` → `migration` → `api`

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | URL de conexão PostgreSQL |
| `JWT_ACCESS_SECRET` | Segredo do access token |
| `JWT_REFRESH_SECRET` | Segredo do refresh token |
| `ENCRYPTION_KEY` | Chave AES-256 para CPF (32 chars) |
| `EMAIL_HOST` | Host SMTP (ex: smtp.gmail.com) |
| `EMAIL_USER` | Usuário do e-mail |
| `EMAIL_APP_PASSWORD` | Senha de aplicativo Google |
| `FRONTEND_URL` | URL do frontend (para links nos e-mails) |

## Testes

```bash
# Unitários
npm test

# Com cobertura
npm run test:cov

# E2E
npm run test:e2e
```

53 testes unitários | 7 suítes

## Deploy (EasyPanel)

O repositório contém o `docker-compose.yml` com todos os serviços.
No EasyPanel, aponte para este repositório e use o docker-compose.
As migrations rodam automaticamente antes da API iniciar.
