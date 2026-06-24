# aws-lambda-vite-tasks

Lista de tareas (To-Do) full-stack **serverless**: backend en AWS (Lambda +
DynamoDB) desplegado con **Terraform**, y frontend en **Vite + React** desplegado en
**Vercel**.

```
Navegador (Vite/React)  ──HTTPS──▶  Lambda Function URL  ──▶  Lambda  ──▶  DynamoDB
```

## Estructura

| Carpeta | Contenido |
|---------|-----------|
| `infra/` | Terraform: DynamoDB, Lambda (Node 20, arm64), Function URL pública, IAM |
| `lambda/` | Código de la función (`index.mjs`): router CRUD sobre DynamoDB |
| `web/` | Frontend Vite + React (UI "diario de quehaceres") |

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

## Despliegue continuo (Vercel)

El repo de GitHub se conecta a Vercel (Root Directory `web/`, preset *Vite*). La
variable `VITE_API_URL` se define en Vercel con la `function_url`. Cada push a la rama
por defecto redepliega; los PRs generan *Preview Deployments*.

---

Tecnologías: AWS Lambda · DynamoDB · API Gateway*  · Terraform · Vite · React · Vercel
<sub>*Probado también con API Gateway HTTP API como alternativa a la Function URL.</sub>
