# Spec: Lista de tareas — AWS Lambda + DynamoDB + Vite + Vercel

Aplicación de lista de tareas (To-Do) con backend serverless en AWS desplegado con
Terraform y un frontend en Vite. El código vive en **GitHub** (repo público,
conectado a Vercel para despliegue continuo); al final se sube también al **GitLab**
de la academia solo como entrega.

## Entorno disponible

- **AWS CLI** con el perfil `iamaster` (usar `AWS_PROFILE=iamaster` o `--profile iamaster`).
- **Terraform** instalado.
- **gh** (GitHub CLI) autenticado en la cuenta `diegocelery` (repo principal de trabajo
  y origen del despliegue continuo en Vercel).
- **glab** configurado contra el GitLab self-hosted de la academia (solo para la entrega final).
- Región AWS por defecto: `us-east-2` (parametrizable en Terraform).

## Estructura del repositorio

```
aws-lambda-vite/
├── CLAUDE.md
├── infra/                 # Terraform
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── lambda.tf
│   ├── dynamodb.tf
│   └── iam.tf
├── lambda/                # Código de la función Lambda
│   ├── index.mjs
│   └── package.json
└── web/                   # Frontend Vite
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
```

---

# 1. Backend — Desplegar con Terraform

## 1.1 DynamoDB

- Tabla `tasks` (parametrizable vía variable `table_name`).
- Modo de capacidad: `PAY_PER_REQUEST` (on-demand, sin gestionar capacidad).
- **Clave primaria:** `id` (String, partition key) — UUID generado en la Lambda.
- Modelo de cada ítem (lista de tareas):

  | Atributo    | Tipo    | Descripción                                  |
  |-------------|---------|----------------------------------------------|
  | `id`        | String  | UUID v4, clave de partición                  |
  | `title`     | String  | Texto de la tarea (requerido)                |
  | `completed` | Boolean | Estado de la tarea (default `false`)         |
  | `createdAt` | String  | Timestamp ISO-8601                           |
  | `updatedAt` | String  | Timestamp ISO-8601                           |

## 1.2 Lambda

- Runtime: `nodejs20.x`, handler `index.handler`, arquitectura `arm64`.
- Empaquetado con `archive_file` (zip) desde `lambda/`. No requiere `node_modules`:
  usa el AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`) ya incluido
  en el runtime `nodejs20.x`.
- Variable de entorno `TABLE_NAME` apuntando a la tabla DynamoDB.
- Implementa un router por método/ruta para exponer un CRUD REST.

### Acceso público — Lambda Function URL

- **Acceso público** mediante **Lambda Function URL** con `authorization_type = "NONE"`
  y CORS habilitado (`allow_origins = ["*"]`, métodos `GET, POST, PUT, DELETE`,
  `allow_headers = ["content-type"]`). El preflight `OPTIONS` lo gestiona la propia
  Function URL (no se incluye en `allow_methods`: AWS limita cada valor a 6 caracteres).
- El evento usa payload v2.0 (`event.requestContext.http.method`, `event.rawPath`).

> **Importante — permisos (cambio AWS de oct-2025):** una Function URL pública requiere
> que el principal `*` tenga **DOS** acciones, no solo una. Con una sola (`InvokeFunctionUrl`,
> el modelo antiguo) la URL devuelve `403 AccessDeniedException`. Se crean dos
> `aws_lambda_permission`:
>
> | statement_id | action | condición |
> |---|---|---|
> | `AllowPublicInvokeFunctionUrl` | `lambda:InvokeFunctionUrl` | `FunctionUrlAuthType = NONE` |
> | `AllowPublicInvokeFunction`    | `lambda:InvokeFunction`    | (ninguna — `FunctionUrlAuthType` solo vale para `InvokeFunctionUrl`) |

### API (sobre la Function URL)

| Método | Ruta          | Acción                                  | Body                        |
|--------|---------------|-----------------------------------------|-----------------------------|
| GET    | `/tasks`      | Listar todas las tareas (`Scan`)        | —                           |
| POST   | `/tasks`      | Crear tarea                             | `{ "title": "..." }`        |
| GET    | `/tasks/{id}` | Obtener una tarea                       | —                           |
| PUT    | `/tasks/{id}` | Actualizar `title` y/o `completed`      | `{ "title", "completed" }`  |
| DELETE | `/tasks/{id}` | Eliminar tarea                          | —                           |

- Respuestas en JSON con cabeceras CORS. Códigos: `200` OK, `201` creado,
  `400` body inválido, `404` no encontrada, `500` error interno.

## 1.3 IAM

- Rol de ejecución de la Lambda con:
  - `AWSLambdaBasicExecutionRole` (logs en CloudWatch).
  - Política mínima sobre la tabla `tasks`: `dynamodb:GetItem`, `PutItem`,
    `UpdateItem`, `DeleteItem`, `Scan` (restringida al ARN de la tabla).

## 1.4 Outputs de Terraform

- `function_url` — URL pública de la Lambda (Function URL). La consume el frontend como
  `VITE_API_URL`.
- `table_name` — nombre de la tabla DynamoDB.

## Testing del backend

1. Desplegar: `terraform init` y `terraform apply --auto-approve` desde `infra/`
   (con `AWS_PROFILE=iamaster`).
2. Probar la Lambda contra la `function_url` del output:
   - `POST /tasks` para crear una tarea y comprobar `201` + ítem devuelto.
   - `GET /tasks` para verificar que aparece en la lista.
   - `PUT /tasks/{id}` para marcarla como completada.
   - `DELETE /tasks/{id}` y confirmar que `GET` ya no la devuelve.
3. Verificar opcionalmente en DynamoDB:
   `aws dynamodb scan --table-name tasks --profile iamaster`.

---

# 2. Frontend — Web en Vite

## 2.1 Stack y configuración

- Proyecto **Vite** (vanilla JS o React — elegir React para una UI profesional).
- La URL de la Lambda se inyecta vía variable de entorno
  `VITE_API_URL` (archivo `.env`, no commitear secretos).

## 2.2 Funcionalidad (UI profesional)

- Diseño limpio y responsive (cabecera, contenedor centrado, estados de carga/error).
- Presentar la **lista de tareas** y todas las operaciones:
  - Crear tarea (input + botón / Enter).
  - Marcar como completada / pendiente (checkbox, con estilo tachado).
  - Editar el título de una tarea.
  - Eliminar tarea.
- Feedback visual: spinner al cargar, mensajes de error, contador de tareas
  pendientes/completadas.

## 2.3 Despliegue

Modelo de despliegue: **el repo público de GitHub se conecta a Vercel** para
despliegue continuo (la integración nativa de Vercel soporta GitHub.com; el GitLab
self-hosted de la academia no, por eso se usa GitHub para desplegar). Cada `git push`
a la rama por defecto dispara automáticamente build y deploy en Vercel; no se usa la
CLI `vercel` para subir artefactos manualmente.

1. Build de producción local: `npm run build` (verificar que compila sin errores).
2. **Crear el repo en GitHub y subir el código** con `gh` (repo **público**):
   `gh repo create <nombre> --public --source=. --remote=origin --push`.
3. **Conectar GitHub a Vercel** (despliegue continuo, paso manual en la web de Vercel):
   - En Vercel: *Add New Project → Import Git Repository* y seleccionar el repo de
     GitHub (autorizar la integración GitHub ↔ Vercel la primera vez).
   - Root Directory: `web/`. Framework preset: *Vite*. Build command `npm run build`,
     output `dist/`.
   - Definir la variable de entorno `VITE_API_URL` en Vercel con la `function_url`
     (Settings → Environment Variables, para Production y Preview).
   - A partir de aquí, cada push a la rama por defecto redepliega solo; los push a
     otras ramas/PRs generan *Preview Deployments*.

### Entrega final en GitLab

Una vez terminado y desplegado, subir el mismo repo al **GitLab self-hosted** de la
academia solo como entrega (no participa en el despliegue):

- Crear el proyecto y empujar con `glab`:
  `glab repo create <nombre> --public` y añadir el remoto, o
  `git remote add gitlab <url>` + `git push gitlab --all`.

## Testing del frontend

1. `npm run dev` y probar el CRUD completo contra la Lambda real.
2. Verificar la web desplegada en Vercel apuntando al API.

---

## Orden de ejecución sugerido

1. Crear `infra/` y desplegar el backend con Terraform → obtener `function_url`.
2. Probar el API con curl/aws cli.
3. Crear `web/` con Vite, configurar `VITE_API_URL`, implementar la UI.
4. Probar en local; subir a **GitHub** (`gh`) y conectar el repo a **Vercel**.
5. Como entrega final, subir el mismo repo al **GitLab** de la academia (`glab`).
