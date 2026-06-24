# Retrospectiva — aws-lambda-vite-tasks

Documento de retrospectiva del proyecto: qué se construyó, qué problemas aparecieron,
cómo se resolvieron y qué se aprendió. Pensado como material de capacitación.

---

## 1. Resumen

App de lista de tareas (To-Do) full-stack serverless:

- **Backend:** AWS Lambda (Node 20, arm64) + DynamoDB, expuesto con **Lambda Function
  URL** pública. Toda la infraestructura como código con **Terraform**.
- **Frontend:** Vite + React, desplegado en **Vercel** con despliegue continuo desde
  GitHub.
- **Entrega:** el código se sube además al GitLab de la academia.

Arquitectura final:

```
Navegador (Vite/React en Vercel)
        │  HTTPS + CORS
        ▼
Lambda Function URL  (authorization_type = NONE)
        │
        ▼
Lambda  index.mjs  (router CRUD)
        │
        ▼
DynamoDB  tabla "tasks"
```

---

## 2. Decisiones de diseño

| Tema | Decisión | Motivo |
|------|----------|--------|
| Acceso público a la Lambda | **Function URL** (no API Gateway) | Una sola Lambda, sin necesidad de rutas múltiples ni auth gestionada. Más simple y gratis. |
| Empaquetado de la Lambda | `archive_file` sin `node_modules` | El runtime `nodejs20.x` ya incluye el AWS SDK v3 (`client-dynamodb`, `lib-dynamodb`). |
| Routing del CRUD | Un router dentro de la Lambda | Una sola función maneja todos los métodos/rutas leyendo `event.requestContext.http.method` y `event.rawPath`. |
| Repo de despliegue | **GitHub** (no el GitLab de la academia) | La integración nativa de Vercel solo soporta GitHub.com / gitlab.com SaaS / Bitbucket. El GitLab de la academia es **self-hosted** → no compatible. |
| CI/CD | Integración nativa GitHub↔Vercel | No requiere `.gitlab-ci.yml` ni runners ni tokens: Vercel construye y despliega solo en cada push. |
| Estética del frontend | "Diario de quehaceres" (editorial/ledger) | UI con carácter, evitando el look genérico. Fraunces + Hanken Grotesk + JetBrains Mono. |

---

## 3. Problemas encontrados y cómo se resolvieron

### 3.1 GitLab self-hosted no es compatible con la integración nativa de Vercel
- **Síntoma:** la spec pedía conectar GitLab a Vercel, pero Vercel solo integra con
  proveedores cloud (GitHub.com, gitlab.com SaaS, Bitbucket cloud).
- **Solución:** usar **GitHub** (cuenta ya configurada en `gh`) como repo de despliegue
  continuo, y dejar el GitLab self-hosted **solo para la entrega final**.
- **Lección:** verificar la compatibilidad de las integraciones antes de asumir el flujo.

### 3.2 La Function URL devolvía `403 AccessDeniedException` (¡el problema gordo!)
- **Síntoma:** la Function URL pública respondía `403` a todo, pese a tener la política
  de recursos aparentemente correcta. El invoke directo (`aws lambda invoke`) sí
  funcionaba → el código estaba bien; el bloqueo estaba en la capa de la URL.
- **Diagnóstico erróneo inicial:** se asumió que era un **SCP de la organización de la
  academia**. **Era falso**: al verificarlo, la cuenta resultó ser **propia y sin
  organización** (`AWSOrganizationsNotInUseException`). Lección de honestidad técnica:
  no dar por buena una hipótesis sin comprobarla.
- **Causa real:** desde **octubre de 2025**, una Function URL pública requiere que el
  principal `*` tenga **DOS** permisos, no solo uno:
  - `lambda:InvokeFunctionUrl`  (con condición `lambda:FunctionUrlAuthType = NONE`)
  - `lambda:InvokeFunction`      (sin esa condición — solo es válida para `InvokeFunctionUrl`)
  Con un solo permiso (el modelo antiguo) → `403`. Lo aportó el usuario.
- **Solución:** dos recursos `aws_lambda_permission` en `infra/lambda.tf`.

### 3.3 Detour a API Gateway (y vuelta atrás)
- Mientras se investigaba el `403`, se montó un **API Gateway HTTP API** como
  alternativa, que funcionó al instante (`payload v2.0`, mismo evento → Lambda sin
  cambios). Una vez identificada la causa real del `403`, se **volvió a la Function
  URL** (más simple y barata) y se eliminó el API Gateway.
- **Lección:** API Gateway es un servicio gestionado de AWS que se pone *delante* de la
  Lambda; útil cuando hay varias rutas/backends, throttling, auth o dominios propios.
  Para una sola Lambda, la Function URL basta.

### 3.4 `Failed to fetch` en el navegador (CORS duplicado)
- **Síntoma:** la web desplegada en Vercel mostraba "Failed to fetch" al cargar y al
  crear tareas. Con `curl` todo funcionaba.
- **Causa:** las cabeceras CORS se añadían **dos veces** — la Function URL las inyecta
  (config `cors {}` en Terraform) y el código de la Lambda **también**. Resultado:
  `Access-Control-Allow-Origin` duplicada → el navegador rechaza la respuesta. `curl`
  no aplica CORS, por eso no se veía por terminal.
- **Solución:** dejar el CORS **solo** en la Function URL; en el handler quedó únicamente
  `Content-Type: application/json`.
- **Lección:** no duplicar la gestión de CORS. Si la Function URL la hace, el código no.

### 3.5 Detalles menores
- **`OPTIONS` en `allow_methods`:** AWS limita cada método a 6 caracteres y `OPTIONS`
  (7) no es válido en la config CORS de la Function URL; el preflight lo gestiona ella
  sola. Se listan solo `GET, POST, PUT, DELETE`.
- **Variables de entorno de Vite:** `VITE_API_URL` se incrusta en **tiempo de build**.
  Cambiarla en Vercel exige **redesplegar**.

---

## 4. Lecciones clave

1. **Comprobar antes de afirmar.** El diagnóstico del `403` como "SCP de la academia"
   fue una suposición no verificada y resultó incorrecta. Verificar (`describe-organization`)
   habría ahorrado tiempo.
2. **Conocer los cambios recientes de la plataforma.** El requisito de dos permisos para
   Function URLs (oct-2025) no era evidente; un dato del usuario desbloqueó todo.
3. **`curl` no es un navegador.** Problemas de CORS no se ven por terminal. Para validar
   la integración real hay que probar desde el navegador (o replicar el preflight).
4. **Mantener una sola fuente de verdad** para responsabilidades transversales como CORS.
5. **La infraestructura como código paga.** Cada cambio (permisos, API Gateway, vuelta a
   Function URL) fue un `terraform apply` reproducible y reversible.

---

## 5. Posibles mejoras futuras

- **Paginación / índices** en DynamoDB si la lista crece (hoy se usa `Scan`, suficiente
  para volúmenes pequeños).
- **Autenticación** (p. ej. Cognito) para listas por usuario.
- **Validación de entrada** más estricta y límites de longitud en el backend.
- **Tests** automatizados del handler (unitarios) y end-to-end del CRUD.
- **Observabilidad:** métricas/alarmas en CloudWatch.
- **Dominio propio** y endurecer CORS a orígenes concretos en lugar de `*`.
