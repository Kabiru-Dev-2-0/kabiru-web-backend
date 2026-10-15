# Kabiru Backend Microservices

Backend untuk Kabiru Web 2.0 menggunakan **NestJS**, **Bun workspaces**, **PostgreSQL**, **Redis**, dan **Docker Compose**.

> **Status:** starter/scaffold untuk pengembangan. Struktur service dan infrastruktur awal bukan berarti seluruh business logic, autentikasi, komunikasi antar-service, Prisma schema/migrations, atau integrasi AI sudah selesai.

## Daftar Isi

- [Arsitektur](#arsitektur)
- [Teknologi](#teknologi)
- [Prasyarat](#prasyarat)
- [Struktur Repository](#struktur-repository)
- [Setup Lokal](#setup-lokal)
- [Menjalankan Infrastruktur](#menjalankan-infrastruktur)
- [Menjalankan Service](#menjalankan-service)
- [Endpoint dan Port](#endpoint-dan-port)
- [Perintah Docker](#perintah-docker)
- [Perintah GitHub](#perintah-github)
- [Environment Variables](#environment-variables)
- [Database dan Prisma](#database-dan-prisma)
- [Redis](#redis)
- [Troubleshooting](#troubleshooting)
- [Tahap Pengembangan Berikutnya](#tahap-pengembangan-berikutnya)

## Arsitektur

Frontend Next.js dikelola di repository terpisah. Repository ini berisi backend dan service internal.

```text
Next.js Frontend
       |
       | HTTP / JSON
       v
API Gateway (NestJS, port 3000)
       |
       | Internal service transport
       +------ Auth Service      (port 4011)
       +------ User Service      (port 4012)
       +------ Learning Service  (port 4013)
       +------ Progress Service  (port 4014)
       +------ AI Service        (port 4015)

Infrastructure:
- PostgreSQL: data persisten
- Redis: cache/data sementara
- Docker Compose: infrastruktur lokal
```

### Prinsip arsitektur

- API Gateway adalah pintu masuk HTTP dari frontend.
- Setiap service memiliki tanggung jawab domain yang jelas.
- Setiap service sebaiknya memiliki database/schema dan kredensial dengan hak akses terpisah.
- Service tidak boleh membaca atau mengubah tabel milik service lain secara langsung; gunakan API/event internal.
- Redis bukan sumber data utama. Data bisnis permanen tetap disimpan di PostgreSQL.
- Jangan menyimpan secret di Git.
- Supabase tidak menjadi dependency target. Migrasi perlu mencakup data, autentikasi/OAuth, RLS, trigger, function, dan storage/Edge Functions jika fitur tersebut digunakan.

> Transport internal dan komunikasi Gateway-to-service harus dikonfigurasi serta diuji sebelum seluruh endpoint dianggap siap. Jangan mengekspos port internal service ke internet pada production.

## Teknologi

- NestJS + TypeScript
- Bun sebagai package manager/workspace
- PostgreSQL
- Redis
- Docker dan Docker Compose
- Prisma ORM (diintegrasikan per service ketika schema dan migration dibuat)

## Prasyarat

Pasang dan verifikasi:

```bash
git --version
bun --version
docker --version
docker compose version
```

Gunakan versi Bun yang kompatibel dengan `package.json` dan `bun.lock` repository. Pastikan Docker Desktop berjalan di Windows.

## Struktur Repository

```text
.
├── apps/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── user-service/
│   ├── learning-service/
│   ├── progress-service/
│   └── ai-service/
├── docs/
│   ├── architecture.md
│   └── services.md
├── infra/
│   └── postgres/
├── compose.yaml
├── .env.example
├── package.json
├── bun.lock
└── README.md
```

Struktur detail dapat berkembang seiring implementasi masing-masing domain.

## Setup Lokal

### 1. Clone repository

Ganti URL berikut dengan URL repository GitHub milikmu.

```bash
git clone https://github.com/USERNAME/kabiru-backend.git
cd kabiru-backend
```

Jika repository sudah ada di komputer, masuk ke folder repository dan tarik perubahan:

```bash
git pull origin main
```

### 2. Buat file environment

Linux/macOS/Git Bash:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Periksa `.env` dan sesuaikan port, kredensial lokal, serta URL database/Redis dengan `compose.yaml`. Jangan commit `.env`.

### 3. Install dependency

Dari root repository:

```bash
bun install
```

Jika repository menggunakan Bun workspaces, jalankan instalasi ini dari root agar dependency workspace di-resolve bersama.

## Menjalankan Infrastruktur

Jalankan PostgreSQL dan Redis:

```bash
docker compose up -d
```

Lihat status container:

```bash
docker compose ps
```

Lihat log:

```bash
docker compose logs -f postgres redis
```

Uji Redis:

```bash
docker compose exec redis redis-cli ping
```

Output yang diharapkan:

```text
PONG
```

Uji PostgreSQL (sesuaikan user/database dengan `compose.yaml`):

```bash
docker compose exec postgres pg_isready -U kabiru -d kabiru_db
```

Jika service di `compose.yaml` memakai nama berbeda, ganti `postgres` atau `redis` sesuai nama service yang sebenarnya.

## Menjalankan Service

Jalankan setiap aplikasi pada terminal terpisah. Jalankan perintah dari root repository.

### API Gateway

```bash
cd apps/api-gateway
bun install
bun run start:dev
```

### Auth Service

Buka terminal baru:

```bash
cd apps/auth-service
bun install
bun run start:dev
```

### User Service

```bash
cd apps/user-service
bun install
bun run start:dev
```

### Learning Service

```bash
cd apps/learning-service
bun install
bun run start:dev
```

### Progress Service

```bash
cd apps/progress-service
bun install
bun run start:dev
```

### AI Service

```bash
cd apps/ai-service
bun install
bun run start:dev
```

> Jika `start:dev` belum didefinisikan di `scripts` pada `package.json` service, periksa scripts yang tersedia dengan `bun run`. Jangan mengasumsikan service sudah terhubung ke Gateway hanya karena prosesnya berhasil berjalan.

Port dan transport yang benar harus mengikuti konfigurasi di `apps/*/src/main.ts`, file environment, dan `docs/services.md`.

## Endpoint dan Port

| Komponen | Port yang direncanakan | Keterangan |
|---|---:|---|
| API Gateway | 3000 | HTTP untuk frontend |
| Auth Service | 4011 | Internal |
| User Service | 4012 | Internal |
| Learning Service | 4013 | Internal |
| Progress Service | 4014 | Internal |
| AI Service | 4015 | Internal |
| PostgreSQL | 5432 | Database lokal |
| Redis | 6379 | Cache lokal |

Port internal di atas adalah rencana konfigurasi. Verifikasi nilai aktual di kode dan konfigurasi sebelum menggunakannya. Endpoint health, bila sudah tersedia, mengikuti route yang didefinisikan pada controller masing-masing. Dokumentasi API (misalnya Swagger) hanya tersedia jika telah dikonfigurasi.

## Perintah Docker

Menyalakan infrastruktur:

```bash
docker compose up -d
```

Menghentikan container tanpa menghapus volume:

```bash
docker compose down
```

Melihat status:

```bash
docker compose ps
```

Melihat log semua service:

```bash
docker compose logs -f
```

Melihat log PostgreSQL:

```bash
docker compose logs -f postgres
```

Melihat log Redis:

```bash
docker compose logs -f redis
```

Restart infrastruktur:

```bash
docker compose restart
```

Menghentikan container sekaligus menghapus volume data **(data lokal akan hilang)**:

```bash
docker compose down -v
```

Jangan gunakan `down -v` jika data development masih diperlukan.

## Perintah GitHub

Periksa perubahan:

```bash
git status
git diff
```

Tambahkan dan commit perubahan:

```bash
git add .
git commit -m "feat: describe your change"
git push origin main
```

Jika repository lokal belum terhubung ke remote:

```bash
git init
git branch -M main
git remote add origin https://github.com/USERNAME/kabiru-backend.git
git add .
git commit -m "chore: initialize backend microservices"
git push -u origin main
```

Pastikan `.env`, secret, credential, file dump database, dan data lokal tidak ikut di-commit.

## Environment Variables

Gunakan `.env.example` sebagai daftar variabel yang diperlukan. Nilai di bawah hanya contoh untuk development; samakan dengan konfigurasi aktual.

```dotenv
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3001

DATABASE_URL=postgresql://kabiru:CHANGE_ME@localhost:5432/kabiru_db?schema=public
REDIS_URL=redis://localhost:6379
```

Jika service berjalan di dalam Docker Compose pada network yang sama, hostname database/Redis umumnya menggunakan nama service Compose, misalnya `postgres` dan `redis`, bukan `localhost`.

Untuk microservice, tentukan konfigurasi koneksi internal masing-masing service melalui environment variable dan jangan menaruh credential produksi dalam file yang dikomit.

## Database dan Prisma

Prisma perlu dikonfigurasi pada setiap service yang memiliki data persisten. Schema dan migration harus mengikuti batas kepemilikan data service.

Sebelum menjalankan command Prisma, pastikan:
1. Dependency Prisma dan adapter PostgreSQL sudah dipasang di workspace/service yang sesuai.
2. File `schema.prisma` dan `prisma.config.ts` tersedia serta menunjuk ke lokasi yang benar.
3. `DATABASE_URL` mengarah ke database yang tepat.
4. Migration dibuat dan ditinjau sebelum diterapkan.

Command umum setelah konfigurasi Prisma tersedia (jalankan dari folder service yang mempunyai schema, atau sesuaikan path schema):

```bash
bunx --bun prisma validate
bunx --bun prisma generate
bunx --bun prisma migrate dev --name init
bunx --bun prisma studio
```

Untuk environment deployment, gunakan migration yang sudah dikomit:

```bash
bunx --bun prisma migrate deploy
```

**Catatan:** command Prisma di atas belum tentu dapat dijalankan langsung pada semua service di scaffold awal karena schema, adapter, dan migration mungkin belum dibuat. Jangan jalankan migration terhadap database produksi tanpa backup dan review.

## Redis

Redis digunakan sebagai cache/data sementara, bukan pengganti PostgreSQL.

Verifikasi koneksi:

```bash
docker compose exec redis redis-cli ping
```

Buka CLI Redis:

```bash
docker compose exec redis redis-cli
```

Contoh perintah di dalam CLI:

```text
PING
SET demo "hello" EX 60
GET demo
DEL demo
EXIT
```

Tentukan TTL, strategi invalidasi, dan perilaku fallback jika Redis tidak tersedia. Hindari cache data privat dengan key global atau menyimpan password/token rahasia di cache.

## Troubleshooting

### Port sudah digunakan

Periksa port yang sedang dipakai di Windows:

```powershell
netstat -ano | findstr :3000
netstat -ano | findstr :5432
netstat -ano | findstr :6379
```

Ubah port host pada `compose.yaml` atau hentikan aplikasi lain yang menggunakan port tersebut. Jangan mengubah port internal service tanpa memperbarui konfigurasi client.

### Container tidak berjalan

```bash
docker compose ps
docker compose logs -f postgres redis
docker compose restart
```

### Dependency tidak ditemukan

Jalankan dari root workspace:

```bash
bun install
```

Jika lockfile tidak sesuai dengan `package.json`, tinjau perubahan dependency dan regenerasi lockfile secara sengaja. Untuk CI, gunakan instalasi frozen lockfile setelah lockfile konsisten.

### Database tidak dapat diakses

- Pastikan container PostgreSQL sehat.
- Pastikan nama database, user, password, dan port sesuai dengan `compose.yaml`.
- Dari host gunakan `localhost`; dari container gunakan nama service Compose.
- Pastikan `DATABASE_URL` tidak mengandung placeholder yang belum diganti.

### Redis tidak dapat diakses

- Pastikan container Redis berjalan.
- Jalankan `docker compose exec redis redis-cli ping`.
- Periksa `REDIS_URL` dan perbedaan hostname host/container.

### Service berjalan tetapi Gateway tidak bisa memanggilnya

Pastikan service benar-benar menggunakan transport yang diharapkan, alamat/port cocok, handler message pattern tersedia, dan client di Gateway telah dikonfigurasi. Status proses yang aktif tidak membuktikan komunikasi antar-service sudah bekerja.

## Tahap Pengembangan Berikutnya

- [ ] Inventarisasi endpoint, tabel, trigger, function, RLS, OAuth, dan storage dari aplikasi lama.
- [ ] Finalisasi batas domain dan ownership database tiap service.
- [ ] Konfigurasi Prisma, schema, migration, dan adapter PostgreSQL.
- [ ] Implementasikan autentikasi dan otorisasi tanpa Supabase.
- [ ] Implementasikan komunikasi Gateway ke setiap service.
- [ ] Tambahkan validasi request, error handling, logging, dan tracing.
- [ ] Tambahkan integration test dan pengujian concurrent request untuk progress/streak.
- [ ] Tambahkan timeout/retry dan observability untuk integrasi AI.
- [ ] Buat Dockerfile/Compose production yang tervalidasi dan CI pipeline.

## Referensi

- [NestJS Documentation](https://docs.nestjs.com/)
- [NestJS Microservices](https://docs.nestjs.com/microservices/basics)
- [Bun Workspaces](https://bun.sh/docs/pm/workspaces)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
