# aws-lambda-vite-tasks

Lista de tareas (To-Do) full-stack **serverless**: backend en AWS (Lambda +
DynamoDB) desplegado con **Terraform**, y frontend en **Vite + React** desplegado en
**Vercel**.

**🔗 Demo en vivo:** https://aws-lambda-vite-tasks.vercel.app/

```
Navegador (Vite/React)  ──HTTPS──▶  Lambda Function URL  ──▶  Lambda  ──▶  DynamoDB
```

> Las decisiones de diseño y los problemas resueltos durante el desarrollo están
> documentados en [RETROSPECTIVA.md](RETROSPECTIVA.md).

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| `infra/` | Terraform: DynamoDB, Lambda (Node 20, arm64), Function URL pública, IAM |
| `lambda/` | Código de la función (`index.mjs`): router CRUD sobre DynamoDB |
| `web/` | Frontend Vite + React (UI "diario de quehaceres") + tests (Vitest) |
| `tests/` | Tests del backend: `unit/` (handler mockeado) y `e2e/` (API real) |

## API

Sobre la **Lambda Function URL** (`authorization_type = NONE`, CORS abierto):

| Método | Ruta | Acción |
|--------|------|--------|
| GET | `/tasks` | Listar tareas |
| POST | `/tasks` | Crear (`{ "title": "..." }`) |
| GET | `/tasks/{id}` | Obtener una |
| PUT | `/tasks/{id}` | Actualizar `title` / `completed` |
| DELETE | `/tasks/{id}` | Eliminar |

## Puesta en marcha

### Backend

```bash
cd infra
AWS_PROFILE=iamaster terraform init
AWS_PROFILE=iamaster terraform apply --auto-approve
# Output: function_url  → úsala como VITE_API_URL
```

> **Nota:** desde oct-2025 una Function URL pública requiere DOS permisos para el
> principal `*`: `lambda:InvokeFunctionUrl` **y** `lambda:InvokeFunction`. Con uno solo
> devuelve `403`. Ambos están en `infra/lambda.tf`.

### Frontend

```bash
cd web
cp .env.example .env      # rellena VITE_API_URL con la function_url
npm install
npm run dev               # http://localhost:5173
npm run build             # build de producción en dist/
```

## Tests

| Tipo | Qué prueba | Herramientas | Cómo se ejecuta |
|------|------------|--------------|-----------------|
| **Unit (backend)** | El handler de la Lambda: routing, CRUD, validaciones (400), 404, sin cabeceras CORS duplicadas. DynamoDB mockeado, sin red. | `node:test` + `aws-sdk-client-mock` | `npm install && npm test` (en la raíz) |
| **E2E (API)** | CRUD completo contra la **API real** desplegada (create → list → update → delete) + 404/400. | `node:test` + `fetch` | `API_URL=<function_url> npm run test:e2e` |
| **Unit (frontend)** | Componentes React (`App`, `TaskRow`): carga, vacío, crear, completar, editar, borrar, error. API mockeado. | Vitest + React Testing Library | `npm test` (en `web/`) |

```bash
# Backend (raíz del repo)
npm install
npm test                                  # unit (14)
API_URL=https://XXXX.lambda-url.us-east-2.on.aws npm run test:e2e   # e2e (3)

# Frontend
cd web
npm install
npm test                                  # unit React (10)
```

## Despliegue continuo (Vercel)

El repo de GitHub se conecta a Vercel (Root Directory `web`, preset *Vite*). La
variable `VITE_API_URL` se define en Vercel con la `function_url` (Production y
Preview). Cada push a la rama por defecto redepliega; los PRs generan *Preview
Deployments*.

> **Importante (Vite):** `VITE_API_URL` se incrusta en **tiempo de build**. Si la
> cambias en Vercel, hay que **redesplegar** para que surta efecto.

---

Tecnologías: AWS Lambda · DynamoDB · Terraform · Vite · React · Vercel
<sub>Durante el desarrollo se probó también API Gateway HTTP API como alternativa a la
Function URL (ver RETROSPECTIVA.md).</sub>
