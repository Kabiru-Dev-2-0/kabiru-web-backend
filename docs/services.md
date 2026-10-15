# Service ports (local development)

| App | Local port | Transport | Publicly exposed? |
|---|---:|---|---|
| api-gateway | 3000 | HTTP | Yes, local dev only |
| auth-service | 4011 | Nest TCP | No |
| user-service | 4012 | Nest TCP | No |
| learning-service | 4013 | Nest TCP | No |
| progress-service | 4014 | Nest TCP | No |
| ai-service | 4015 | Nest TCP | No |

Internal services are separate NestJS apps, but the gateway's downstream client wiring is intentionally not included yet. Implement service contracts and error/timeout behavior before routing business traffic.
