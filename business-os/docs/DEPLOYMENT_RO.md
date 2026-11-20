# SMITH BUSINESS OS — Ghid de instalare și utilizare (pilot 0.1)

## 1. Conținut și limite
Un centru comun pentru șase proiecte, cu separare strictă la nivel de chei API, înregistrarea KPI-urilor din surse identificate, propuneri de sarcini ale agenților AI și aprobări umane. **Nu este un motor de execuție AI, nu trimite emailuri, nu editează site-uri și nu pornește campanii sau plăți.** Nu am importat date private sau financiare. Dashboardul nu afișează cifre fictive.

## 2. Cerințe
- Node.js 22+ pentru rulare locală; Docker Engine + Compose pentru VPS.
- HTTPS și reverse proxy (NGINX/Caddy), autentificare suplimentară pentru pagina privată și limitarea accesului la VPN/IP, dacă este posibil.
- Backup pentru volumul de date înaintea fiecărei actualizări.

## 3. Instalare locală
1. Copiază directorul `business-os/` pe calculator/server.
2. `cd business-os && cp .env.example .env` (pe Windows, copiază manual).
3. Generează un secret lung pentru proprietar și câte unul separat pentru fiecare proiect: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
4. Definește `SMITH_OS_KEYS_JSON` drept un JSON array într-o variabilă de mediu a procesului (exemple mai jos). **Node nu citește automat `.env` în această versiune**: folosește `node --env-file=.env src/server.mjs` pentru rulare locală sau `env_file:` în Docker Compose. Evită apostrofurile în valorile din `.env` dacă folosești Docker Compose; consultă regulile de escaping ale Compose.
5. Rulează `npm test` și `npm run check`, apoi `node --env-file=.env src/server.mjs`.
6. Deschide `http://127.0.0.1:8788` și introdu cheia proprietarului. Cheia rămâne numai în memoria tabului curent și se pierde la refresh; nu este salvată în localStorage.

Exemplu **DOAR CA FORMAT**, în `.env` (substituie toate valorile cu chei reale generate de tine):

```dotenv
PORT=8788
HOST=127.0.0.1
SMITH_OS_KEYS_JSON=[{"key":"REPLACE_WITH_A_RANDOM_64_CHARACTER_OWNER_KEY_000000000000000000000","role":"owner"},{"key":"REPLACE_WITH_A_SEPARATE_RANDOM_64_CHARACTER_PROJECT_KEY_0000000","role":"project","projectId":"smith-academy"}]
```

Dacă lucrezi cu `docker compose`, `HOST` și calea DB sunt furnizate de `docker-compose.yml`. Completează câte o intrare cu rol `project` pentru fiecare aplicație autorizată.

## 4. API (doar server-to-server)

| Metodă | Endpoint | Rol | Efect |
| --- | --- | --- | --- |
| GET | `/health` | public | status minimal, fără date |
| GET | `/api/v1/projects` | owner/proiect | proiecte autorizate |
| GET | `/api/v1/summary?period=2026-11` | owner/proiect | indicatori pentru propriile proiecte |
| GET | `/api/v1/projects/:id/metrics?period=2026-11` | owner/proiect | raport KPI cu sursă |
| POST | `/api/v1/projects/:id/metrics` | owner/proiect | scrie un indicator demonstrabil |
| GET | `/api/v1/jobs` | owner/proiect | propuneri proprii |
| POST | `/api/v1/jobs` | owner/proiect | creează DRAFT |
| POST | `/api/v1/jobs/:id/approve` | **owner** | aprobă fără execuție |
| POST | `/api/v1/jobs/:id/reject` | **owner** | respinge |
| GET | `/api/v1/audit` | **owner** | jurnal limitat la ultimele 100 evenimente |

Exemplu de import metrică, **numai pentru o valoare verificată**:

```bash
curl -X POST https://business.example.ro/api/v1/projects/smith-academy/metrics \
  -H "Authorization: Bearer $SMITH_OS_PROJECT_TOKEN" -H 'Content-Type: application/json' \
  -d '{"key":"leads","value":3,"period":"2026-11","sourceRef":"crm-monthly-report:2026-11"}'
```

Veniturile și cheltuielile sunt exprimate în *unități minore* (bani/centime) și numai **numere întregi**. Fără ambele valori nu calculăm profitul. Nu adunăm RON, CHF și EUR în același total.

## 5. Conectarea celor șase proiecte
- **SMITH Academy**: `projectId=smith-academy`; semnale agregate, fără profiluri de minori.
- **România Promovată**: `projectId=romania-promovata`; cereri comerciale, fără date personale despre turiști.
- **Suisse Promoted**: `projectId=suisse-promoted`; valori CHF și informații doar agregate.
- **CORFILS**: `projectId=corfils`; KPI din inventar/comenzi, fără coduri personale sau plăți brute.
- **Servicio Técnico Madrid**: `projectId=electrohelp-es`; valori EUR din rapoarte CRM verificate.
- **Casa cu Piese**: `projectId=casa-cu-piese`; KPI commerce anonimizate, fără date de checkout.

Fiecare repository primește `integrations/smith-business-os/client.mjs` (client Node server-side) și documentația pentru conectarea controlată. **Codul clienților nu este conectat automat la backendurile actuale.** Trebuie create adaptoare server-side autorizate pentru fiecare aplicație și testate separat.

## 6. Docker și infrastructură
`docker compose up --build -d` pornește API-ul pe `127.0.0.1:8788` al serverului, nu public pe Internet. Configurează un reverse proxy HTTPS și autentificare pentru portal. Setează `SMITH_OS_KEYS_JSON` în fișier de secrete protejat. Volumul `smith_os_data` persistă metricile, sarcinile și jurnalul. **Backup:** oprește temporar scrierile, creează un snapshot al volumului și verifică restaurarea într-un mediu separat; pentru mai multe instanțe se recomandă migrarea în PostgreSQL cu backup automat.

## 7. Emailuri, agenți, monetizare
- Notificările de aprobare, alertele KPI și sumarul săptămânal: în backlog; nu sunt trimise automat.
- Pentru emailuri reale: domeniu validat, SPF/DKIM/DMARC, furnizor (SES/Resend/Postmark), politici opt-in, rate limit și jurnal de livrare. Cheile rămân server-side.
- Cei opt agenți sunt tipuri de sarcini. `DRAFT` și `APPROVED` NU execută apeluri către alte aplicații. Un executor viitor va avea un set de permisiuni granular și confirmare explicită a acțiunilor cu risc.
- Pentru SaaS/white-label sunt necesare: tenancy DB, autentificare umană, contracte, GDPR/DPA, billing, quota, metering, SLA și termeni comerciali.

## 8. Limitări de producție și rollback
**Pilot, nu production-ready.** Persistența JSON este destinată unei singure instanțe. Lipsesc OIDC/SSO, rate limit distribuit, monitorizare, backup automat, RBAC dinamic, test de penetrare, chei stocate în vault și integrarea reală a furnizorilor.

Rollback GitHub: închide/revertește PR-ul de pe fiecare repository fără merge; pe VPS oprește containerul și revino la versiunea anterioară după backup. Niciun deployment nu este inclus sau executat de acest pachet.
