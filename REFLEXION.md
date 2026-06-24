# Reflexión de cierre

Lo que empezó como "desplegar una Lambda y una web" terminó siendo, sobre todo, un
**ejercicio de diagnóstico**. El código del CRUD fue lo fácil; lo valioso estuvo en los
obstáculos:

- **El `403` de la Function URL** enseñó que la plataforma cambia bajo tus pies: desde
  octubre de 2025 hacen falta *dos* permisos (`lambda:InvokeFunctionUrl` **y**
  `lambda:InvokeFunction`), no uno. Ningún `terraform apply` "correcto" lo revelaba —
  solo leer el síntoma con calma lo resolvió.
- **El "Failed to fetch"** recordó que *curl no es un navegador*: el CORS duplicado solo
  se manifestaba en el browser. Validar "de verdad" implica probar en el medio real, no
  solo por terminal.
- **El falso "SCP de la academia"** fue la lección más humana: se dio por buena una
  hipótesis sin verificarla. Comprobar antes de afirmar habría ahorrado un rodeo entero.

Un par de aprendizajes de criterio:

- **Lo simple gana cuando encaja**: volver de API Gateway a la Function URL fue elegir
  la herramienta justa, no la más vistosa.
- **La infraestructura como código se pagó sola**: cada vuelta atrás fue reproducible y
  reversible.

**En una frase:** un proyecto pequeño en alcance pero completo en ciclo —infra, API, UI,
CI/CD, tests y entrega— donde lo que más enseñó no fue construir, sino *entender por qué
algo no funcionaba* y verificarlo en lugar de suponerlo.

> Detalle técnico de cada problema y su solución en [RETROSPECTIVA.md](RETROSPECTIVA.md).
