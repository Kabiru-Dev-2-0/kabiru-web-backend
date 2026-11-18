# Dokumentasi Resmi API Gateway LMS KABIRU (v1)

Dokumentasi ini mencakup seluruh endpoint yang terdaftar di **API Gateway (`apps/api-gateway`)**, lengkap dengan penjelasan use case, header (Development vs Production), contoh payload request, dan response standar.

---

## 1. Konsep & Standar Komunikasi API

### 1.1 Base URL & Versi
* **Base URL Lokal:** `http://localhost:3000/v1`
* **Format Response:** JSON UTF-8
* **Cross-Origin (CORS):** Mengizinkan origin frontend yang terdaftar di `CORS_ORIGINS` (default: `http://localhost:3001`).

### 1.2 Format Envelope Response
Semua response dari API Gateway dibungkus dalam format envelope standar:

#### Response Berhasil (Single Resource):
```json
{
  "data": { ... },
  "meta": {
    "requestId": "fbf605ff-bf27-422d-88c8-4ea2a574bfba"
  }
}
```

#### Response Berhasil (List / Paginated):
Seluruh endpoint list secara otomatis diratakan (*flattened*) oleh API Gateway agar frontend dapat langsung memanggil `.map()`:
```json
{
  "data": [ ...items ],
  "meta": {
    "requestId": "fbf605ff-bf27-422d-88c8-4ea2a574bfba",
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 15,
      "totalPages": 1
    }
  }
}
```

#### Response Gagal (Error):
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Deskripsi kesalahan teknis atau validasi.",
    "details": [
      {
        "field": "title",
        "reason": "Judul minimal 3 karakter"
      }
    ]
  },
  "meta": {
    "requestId": "fbf605ff-bf27-422d-88c8-4ea2a574bfba"
  }
}
```

---

## 2. Standar Autentikasi & Header

Gateway mendukung dua metode otentikasi berdasarkan environment:

### A. Environment Development (Hoppscotch / Testing Lokal)
Pada development, simulasi role diaktifkan melalui konfigurasi `ENABLE_DEV_ACTOR_HEADERS=true` di file `.env`. Kamu dapat melewati login formal dengan menyematkan header simulasi:

| Header Key | Nilai Contoh | Keterangan |
|---|---|---|
| `x-dev-role` | `teacher` \| `student` \| `admin` \| `developer` | Mensimulasikan aktor login tanpa token JWT |
| `x-dev-user-id` | `00000000-0000-4000-8000-000000000001` | (Opsional) Menentukan ID user tertentu |
| `x-request-id` | `UUIDv4` | (Opsional) ID pelacakan log request |

### B. Environment Production (Frontend Nyata)
Pada production, `ENABLE_DEV_ACTOR_HEADERS` dinonaktifkan (`false`). Seluruh request wajib menyertakan Bearer Token resmi dari hasil login:

| Header Key | Nilai Contoh | Keterangan |
|---|---|---|
| `Authorization` | `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Token akses JWT yang valid |
| `Content-Type` | `application/json` | Wajib untuk request method POST, PATCH, PUT |

### C. Matriks Hak Akses RBAC (Role-Based Access Control)
Sistem membedakan hak akses berdasarkan 4 role pengguna:
1. **`student` (Siswa):** Akses ruang belajar publik, materi terpublikasi (tanpa kunci jawaban), eksplorasi mapel/topik, game player, AI hint, dan profil pribadi. Ditolak (`403 FORBIDDEN`) jika mengakses authoring CMS, kunci jawaban, modul game studio, atau administrasi user.
2. **`teacher` (Guru):** Semua hak akses siswa ditambah pengelolaan kurikulum (CRUD mapel, topik, materi), melihat materi draft & kunci jawaban, mengunggah aset materi, serta membuat dan mempublikasikan game modul berbasis template bawaan.
3. **`developer` (Pengembang Game):** Semua hak akses guru ditambah pembuatan modul game custom (HTML/CSS/JS) dan manipulasi custom code files via editor Monaco.
4. **`admin` (Administrator Sistem):** Akses penuh ke seluruh fitur sistem, termasuk manajemen pengguna global (`GET /users`), pengubahan role akun (`PATCH /users/:userId/role`), dan pembuatan akun administratif (`POST /users`).

| Fitur / Endpoint | Publik / Anon | `student` | `teacher` | `developer` | `admin` |
|---|:---:|:---:|:---:|:---:|:---:|
| `POST /auth/register` (Registrasi Publik) | ✅ (menjadi student) | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/login`, `POST /auth/refresh` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET /users/me`, `PATCH /users/me/profile` | ❌ (401) | ✅ | ✅ | ✅ | ✅ |
| `GET /users` (Daftar Pengguna) | ❌ (401) | ❌ (403) | ❌ (403) | ❌ (403) | ✅ |
| `PATCH /users/:userId/role` (Ubah Role) | ❌ (401) | ❌ (403) | ❌ (403) | ❌ (403) | ✅ |
| `POST /users` (Buat User Administratif) | ❌ (401) | ❌ (403) | ❌ (403) | ❌ (403) | ✅ |
| `GET /learning/subjects`, `topics`, `materials` | ✅ | ✅ | ✅ (termasuk draft) | ✅ (termasuk draft) | ✅ (termasuk draft) |
| `GET /learning/materials/:id/authoring` (Kunci Jawaban) | ❌ (401) | ❌ (403) | ✅ | ✅ | ✅ |
| `POST /learning/subjects`, `topics`, `materials` (CRUD) | ❌ (401) | ❌ (403) | ✅ | ✅ | ✅ |
| `POST /learning/assets` (Upload Aset) | ❌ (401) | ❌ (403) | ✅ | ✅ | ✅ |
| `GET /game/templates`, `/game/player/:id` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `GET/POST /game/modules` (Modul Template) | ❌ (401) | ❌ (403) | ✅ (modul sendiri) | ✅ (semua) | ✅ (semua) |
| `POST /game/modules` (Modul Custom) | ❌ (401) | ❌ (403) | ❌ (403) | ✅ | ✅ |
| `PUT /game/versions/:id/files` (Monaco Custom Code) | ❌ (401) | ❌ (403) | ❌ (403) | ✅ | ✅ |
| `POST /ai/generate`, `/ai/submit` | ✅ / ❌ (401) | ✅ | ✅ | ✅ | ✅ |

---

## 3. Akun Bawaan Testing (Seed Dev Users)
Seluruh akun berikut memiliki password default: **`password123`**

| Email | Role | Deskripsi Kegunaan |
|---|---|---|
| `guru@kabiru.id` | `teacher` | Pengujian pembuatan kurikulum, materi draft, kunci jawaban, dan Game Module Studio |
| `siswa@kabiru.id` | `student` | Pengujian alur belajar siswa, eksplorasi kurikulum published, dan player game |
| `admin@kabiru.id` | `admin` | Pengujian manajemen global seluruh modul, user, dan jenjang |
| `dev@kabiru.id` | `developer` | Pengujian Monaco Editor custom game (HTML/CSS/JS) |

---

## 4. Katalog Endpoint Lengkap

---

### DOMAIN 1: SISTEM & HEALTH CHECK

#### 1. `GET /health`
* **Use Case:** Digunakan oleh load balancer, orchestration container (Docker/K8s), atau script monitoring DevOps untuk memastikan API Gateway hidup dan terhubung ke microservice internal secara sehat.
* **Headers:**
  * Development / Production: *Tidak memerlukan header autentikasi.*
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": {
      "status": "ok",
      "service": "learning-service",
      "timestamp": "2026-11-15T05:00:00.000Z"
    },
    "meta": {
      "requestId": "6a96bc28-1ef9-4091-bf96-fc8df6d5ef01"
    }
  }
  ```

---

### DOMAIN 2: AUTENTIKASI & AKUN (`auth-service`)

#### 2. `POST /auth/register`
* **Use Case:** Digunakan pada halaman Registrasi Siswa di Frontend. Sesuai prinsip keamanan OWASP (Anti-Privilege Escalation), siapapun yang mendaftar melalui endpoint publik ini akan selalu diberikan hak akses role `student`. Gateway secara otomatis mengorkestrasi pembuatan profil awal di `user-service`.
* **Headers:** `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "email": "siswa.baru@kabiru.id",
    "password": "password123",
    "fullName": "Ahmad Siswa Baru"
  }
  ```
* **Expected Response (`201 Created`):**
  ```json
  {
    "data": {
      "userId": "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed",
      "role": "student",
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900
    },
    "meta": {
      "requestId": "22ff5d4b-70c1-4bcf-8705-cb66bfde9301"
    }
  }
  ```

#### 3. `POST /auth/login`
* **Use Case:** Dipanggil saat pengguna memasukkan email dan password di halaman Login. Mengembalikan pasangan `accessToken` (berlaku 15 menit) dan `refreshToken` (berlaku 7 hari).
* **Headers:** `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "email": "guru@kabiru.id",
    "password": "password123"
  }
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": {
      "userId": "00000000-0000-4000-8000-000000000001",
      "role": "teacher",
      "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresIn": 900
    },
    "meta": {
      "requestId": "5d5cfc97-6a75-47e1-88f6-fcba82e5436f"
    }
  }
  ```

#### 4. `POST /auth/refresh`
* **Use Case:** Dipanggil secara transparan oleh Axios/Fetch Interceptor di frontend ketika `accessToken` kedaluwarsa (mendapat response 401), sehingga pengguna tidak ter-logout secara mendadak.
* **Headers:** `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
* **Expected Response (`200 OK`):** Mengembalikan accessToken dan refreshToken baru.

---

### DOMAIN 3: MANAJEMEN PROFIL PENGGUNA (`user-service`)

#### 5. `GET /users/me`
* **Use Case:** Dipanggil sesaat setelah aplikasi frontend dimuat pertama kali untuk memvalidasi sesi aktif pengguna dan mengisi state global auth (menampilkan nama, avatar, dan hak akses di navbar).
* **Headers:**
  * Development: `x-dev-role: teacher` (atau Bearer token)
  * Production: `Authorization: Bearer <TOKEN>`
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": {
      "id": "00000000-0000-4000-8000-000000000001",
      "userId": "00000000-0000-4000-8000-000000000001",
      "fullName": "Guru Penguji",
      "schoolName": "SMA Negeri 1 Kabiru",
      "educationLevel": "SMA",
      "role": "teacher",
      "phone": null,
      "avatarUrl": null,
      "createdAt": "2026-11-14T21:00:00.000Z",
      "updatedAt": "2026-11-14T21:00:00.000Z"
    },
    "meta": {
      "requestId": "d4d8fc22-7df7-4632-9df7-ee7dfdb8421a"
    }
  }
  ```

#### 6. `PATCH /users/me/profile`
* **Use Case:** Dipakai pada halaman "Pengaturan Akun / Profil Saya" untuk memperbarui informasi personal pengguna yang sedang login.
* **Headers:**
  * Development: `x-dev-role: teacher`
  * Production: `Authorization: Bearer <TOKEN>`
  * `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "fullName": "Guru Penguji, M.Kom.",
    "phone": "081234567890",
    "avatarUrl": "https://cdn.kabiru.id/avatars/guru.png",
    "schoolName": "SMA Unggulan Kabiru"
  }
  ```
* **Expected Response (`200 OK`):** Mengembalikan objek profil yang telah diperbarui.

#### 7. `GET /users`
* **Use Case:** Halaman Manajemen Pengguna di Dashboard Admin. Digunakan oleh admin untuk melihat seluruh daftar pengguna LMS beserta role dan informasi sekolahnya.
* **Hak Akses:** Khusus role `admin`. Role lain akan ditolak dengan `403 FORBIDDEN`.
* **Headers:**
  * Development: `x-dev-role: admin`
  * Production: `Authorization: Bearer <ADMIN_TOKEN>`
* **Query Params (Opsional):**
  * `role`: Filter berdasarkan role (`student` | `teacher` | `admin` | `developer`)
  * `search`: Pencarian nama atau email pengguna
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "00000000-0000-4000-8000-000000000001",
        "userId": "00000000-0000-4000-8000-000000000001",
        "email": "guru@kabiru.id",
        "fullName": "Guru Penguji",
        "role": "teacher",
        "schoolName": "SMA Negeri 1 Kabiru",
        "educationLevel": "SMA",
        "phone": null,
        "avatarUrl": null,
        "createdAt": "2026-11-14T21:00:00.000Z",
        "updatedAt": "2026-11-14T21:00:00.000Z"
      }
    ],
    "meta": {
      "requestId": "..."
    }
  }
  ```

#### 8. `GET /users/:userId`
* **Use Case:** Melihat detail profil pengguna spesifik.
* **Hak Akses:** Hanya boleh diakses oleh Admin atau user pemilik akun itu sendiri (`userId === actor.userId`). User lain akan menerima `403 FORBIDDEN`.
* **Headers:** Bearer Token atau dev role header.
* **Expected Response (`200 OK`):** Mengembalikan objek profil pengguna.

#### 9. `PATCH /users/:userId/role`
* **Use Case:** Manajemen RBAC Admin. Mengubah hak akses role pengguna (misalnya mempromosikan siswa menjadi guru, atau menambahkan developer). Perubahan role ini disinkronisasikan ke `auth-service` dan `user-service` sehingga langsung berlaku saat login atau refresh token.
* **Hak Akses:** Khusus role `admin`. Role lain ditolak `403 FORBIDDEN`.
* **Headers:**
  * Development: `x-dev-role: admin`
  * Production: `Authorization: Bearer <ADMIN_TOKEN>`
  * `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "role": "teacher"
  }
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": {
      "userId": "00000000-0000-4000-8000-000000000004",
      "email": "siswa@kabiru.id",
      "role": "teacher",
      "message": "Role pengguna berhasil diperbarui menjadi 'teacher'."
    },
    "meta": {
      "requestId": "..."
    }
  }
  ```

#### 10. `POST /users`
* **Use Case:** Pendaftaran Pengguna Administratif oleh Admin (misalnya membuat akun pengajar baru atau developer game tanpa melalui registrasi publik).
* **Hak Akses:** Khusus role `admin`.
* **Headers:** `x-dev-role: admin`, `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "email": "guru.baru@kabiru.id",
    "password": "password123",
    "fullName": "Guru Baru",
    "role": "teacher",
    "schoolName": "SMA Kabiru",
    "educationLevel": "SMA"
  }
  ```
* **Expected Response (`201 Created`):** Objek akun dan profil pengguna baru yang dibuat.

---

### DOMAIN 4: KURIKULUM & MATERI - READ SISWA & PUBLIK (`learning-service`)

#### 7. `GET /learning/education-levels`
* **Use Case:** Menampilkan pilihan jenjang pendidikan (SD, SMP, SMA) di halaman landing page eksplorasi kurikulum.
* **Headers:** Bebas (endpoint publik).
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": [
      { "id": "11111111-1111-4111-8111-111111111001", "code": "SD", "name": "Sekolah Dasar" },
      { "id": "11111111-1111-4111-8111-111111111002", "code": "SMP", "name": "Sekolah Menengah Pertama" },
      { "id": "11111111-1111-4111-8111-111111111003", "code": "SMA", "name": "Sekolah Menengah Atas" }
    ],
    "meta": { "requestId": "..." }
  }
  ```

#### 8. `GET /learning/subjects?level=SMA`
* **Use Case:** Mengambil daftar mata pelajaran berdasarkan jenjang yang dipilih siswa di halaman pemilihan kursus/mapel.
* **Query Params:**
  * `level` (wajib): `SD` \| `SMP` \| `SMA`
  * `search` (opsional): kata kunci nama mapel
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": [
      {
        "id": "11111111-1111-4111-8111-111111111102",
        "educationLevelId": "11111111-1111-4111-8111-111111111003",
        "educationLevelCode": "SMA",
        "name": "Informatika",
        "publishedTopicCount": 1
      }
    ],
    "meta": { "requestId": "..." }
  }
  ```

#### 9. `GET /learning/topics?level=SMA&subjectId=...&page=1&limit=20`
* **Use Case:** Menampilkan silabus / daftar bab topik belajar. Endpoint ini cerdas membaca konteks aktor: jika diakses oleh siswa/publik, topik berstatus `draft` akan otomatis disembunyikan. Namun jika diakses guru, semua draft akan tampil.
* **Query Params:** `level` (wajib), `subjectId` (opsional), `page` (default 1), `limit` (default 20).
* **Expected Response (`200 OK`):** Mengembalikan array topik beserta `meta.pagination`.

#### 10. `GET /learning/materials?topicId=...&page=1&limit=50`
* **Use Case:** Menampilkan daftar materi / sub-bab / alur linear belajar di dalam sebuah topik (seperti tampilan roadmap / level Duolingo).
* **Query Params:** `topicId` (wajib), `status` (opsional jika role guru), `page`, `limit`.
* **Expected Response (`200 OK`):** Mengembalikan daftar item materi beserta jumlah tes/kuis yang ada di dalamnya.

#### 11. `GET /learning/materials/:materialId`
* **Use Case:** Halaman Ruang Belajar Siswa. Mengambil konten isi bacaan materi (Markdown), rangkuman, capaian belajar, tombol navigasi bab selanjutnya/sebelumnya, serta latihan soal.
* **Catatan Keamanan (Security by Design):** Endpoint ini **tidak menyertakan kunci jawaban (`answerKey`)** dan menyaring test case rahasia agar siswa tidak dapat membongkar jawaban lewat Inspect Element.
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": {
      "id": "11111111-1111-4111-8111-111111111301",
      "number": 1,
      "title": "Pengenalan Array & Kompleksitas Waktu",
      "description": "Memahami indeks memori dan notasi Big-O dasar.",
      "learningOutcome": "Siswa mampu membedakan akses O(1) dan pencarian linear O(n).",
      "content": "# Pengenalan Array\n\nArray menyimpan data secara kontigu...",
      "summary": "Array menyimpan elemen bertipe sama secara berurutan.",
      "status": "published",
      "breadcrumb": { "educationLevelCode": "SMA", "subjectName": "Informatika", ... },
      "navigation": { "previousMaterialId": null, "nextMaterialId": "..." },
      "tests": [
        {
          "id": "11111111-1111-4111-8111-111111111401",
          "title": "Kompleksitas Akses Indeks Array",
          "questionType": "multiple_choice",
          "prompt": "Berapakah kompleksitas waktu mengakses elemen array langsung melalui indeks ke-i?",
          "points": 10,
          "payload": {
            "options": [
              { "id": "opt-a", "text": "O(1)" },
              { "id": "opt-b", "text": "O(n)" }
            ]
          },
          "sampleTestCases": [
            { "id": "...", "input": "arr = [10, 20, 30], idx = 1", "expectedOutput": "20" }
          ]
        }
      ]
    },
    "meta": { "requestId": "..." }
  }
  ```

#### 12. `GET /learning/materials/:materialId/authoring`
* **Use Case:** Khusus digunakan pada Dashboard CMS Guru / Editor Materi. Berbeda dengan endpoint siswa di atas, endpoint ini **menampilkan kunci jawaban (`answerKey`)** dan seluruh test case rahasia (`isHidden: true`) untuk kebutuhan review dan evaluasi guru.
* **Headers Wajib:** `x-dev-role: teacher` (Dev) atau Bearer Token Guru (Prod). Akses role siswa akan menerima `403 FORBIDDEN`.
* **Expected Response (`200 OK`):** Struktur materi lengkap dengan `tests[].answerKey` dan `tests[].testCases[].isHidden`.

---

### DOMAIN 5: MANAJEMEN KURIKULUM - AUTHORING CRUD GURU/ADMIN (`learning-service`)

> **Hak Akses:** Seluruh endpoint bagian ini wajib memiliki hak akses role `teacher`, `admin`, atau `developer`.

#### 13. `POST /learning/subjects`
* **Use Case:** Menambah mata pelajaran baru dalam suatu jenjang pendidikan melalui CMS Admin.
* **Request Body:**
  ```json
  {
    "educationLevelCode": "SMA",
    "name": "Matematika Tingkat Lanjut"
  }
  ```
* **Expected Response (`201 Created`):** Mengembalikan data subject yang baru dibuat.

#### 14. `PATCH /learning/subjects/:subjectId` & `DELETE /learning/subjects/:subjectId`
* **Use Case:** Mengubah nama mapel atau menghapusnya (akan ditolak 409 jika mapel masih memiliki topik aktif).

#### 15. `POST /learning/topics`
* **Use Case:** Guru membuat bab topik baru di bawah mata pelajaran tertentu.
* **Request Body:**
  ```json
  {
    "subjectId": "11111111-1111-4111-8111-111111111102",
    "number": 3,
    "title": "Algoritma Greedy & Pohon Keputusan",
    "description": "Konsep pemilihan langkah lokal optimal untuk mencapai solusi global.",
    "status": "draft"
  }
  ```
* **Expected Response (`201 Created`):** Mengembalikan data topik baru.

#### 16. `PATCH /learning/topics/:topicId` & `DELETE /learning/topics/:topicId`
* **Use Case:** Guru memperbarui isi/urutan topik atau menghapusnya. Menghapus topik akan melakukan **soft-delete** bersama seluruh materi di dalamnya.

#### 17. `POST /learning/materials`
* **Use Case:** Guru menulis dan menyimpan lembar materi baru dalam topik.
* **Request Body:**
  ```json
  {
    "topicId": "11111111-1111-4111-8111-111111111201",
    "number": 3,
    "title": "Pendalaman Queue & Deque",
    "description": "Struktur antrean FIFO dan implementasi circular buffer.",
    "learningOutcome": "Siswa mampu menerapkan queue pada simulasi antrean kasir.",
    "content": "# Struktur Data Queue\n\nQueue menggunakan prinsip FIFO...",
    "summary": "Elemen pertama yang masuk adalah yang pertama diproses.",
    "status": "draft"
  }
  ```
* **Expected Response (`201 Created`):** Mengembalikan data materi baru.

#### 18. `PATCH /learning/materials/:materialId` & `DELETE /learning/materials/:materialId`
* **Use Case:** Guru memperbarui isi tulisan materi atau menghapus materi (soft-delete).

---

### DOMAIN 6: PENYIMPANAN ASSET / FILE (`storage`)

#### 19. `POST /learning/assets`
* **Use Case:** Dipanggil saat guru mengunggah gambar cover topik, cover materi, atau icon badge ke Cloudflare R2 / Local Storage.
* **Headers:** `x-dev-role: teacher`, `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "folder": "topics",
    "fileName": "cover-array.png",
    "mimeType": "image/png",
    "encoding": "base64",
    "content": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "kind": "image"
  }
  ```
* **Expected Response (`201 Created`):**
  ```json
  {
    "data": {
      "id": "c3d9a108-9df2-4720-bc72-6a7f3efc2108",
      "kind": "image",
      "storagePath": "lms/topics/030e8c75...-cover-array.png",
      "mimeType": "image/png",
      "sizeBytes": 68,
      "sha256": "030e8c751283c847d0...4b574",
      "publicUrl": "http://localhost:3000/assets/lms/topics/...",
      "createdAt": "2026-11-15T05:10:00.000Z"
    },
    "meta": { "requestId": "..." }
  }
  ```

#### 20. `GET /learning/assets/:assetId`
* **Use Case:** Mengambil metadata detail file asset berdasarkan ID uniknya.

---

### DOMAIN 7: GAME MODULE STUDIO & RUNTIME PLAYER (`game-module`)

#### 21. `GET /game/templates`
* **Use Case:** Halaman Studio Pembuatan Game Guru. Menampilkan katalog 8 jenis permainan bawaan (*Multiple Choice, Sorting, Checkbox, Fill in the Blank, Drag & Drop, Pattern Painter, Maze Runner, Code Debugger*) lengkap dengan `configSchema` (JSON Schema) yang dipakai frontend untuk membangun formulir input guru secara otomatis tanpa coding.
* **Expected Response (`200 OK`):** Mengembalikan daftar template beserta `configSchema` dan `defaultConfig`.

#### 22. `GET /game/templates/:templateId`
* **Use Case:** Mengambil skema konfigurasi detail dari satu jenis template (misal: `sorting` atau `drag_drop`).

#### 23. `GET /game/modules`
* **Use Case:** Daftar modul game buatan guru di halaman manajemen game. Sesuai aturan FR-17: Guru hanya melihat modul buatannya sendiri, sedangkan Admin/Developer dapat melihat seluruh modul.
* **Headers:** `x-dev-role: teacher` (Dev) atau Bearer Token (Prod).

#### 24. `POST /game/modules`
* **Use Case:** Guru atau Developer membuat instance modul game baru. Jika `source: "template"`, maka `templateId` wajib disertakan. Jika `source: "custom"`, modul hanya bisa dibuat oleh role `developer`/`admin`.
* **Request Body (Jalur Template Guru):**
  ```json
  {
    "name": "Kuis Logika Sorting Array",
    "description": "Latihan mengurutkan langkah algoritma pengurutan data.",
    "source": "template",
    "templateId": "sorting"
  }
  ```
* **Expected Response (`201 Created`):** Membuat modul game dan otomatis menginisialisasi draft versi pertama `1.0.0`.

#### 25. `POST /game/modules/:moduleId/versions`
* **Use Case:** Membuat draf versi baru untuk modul game yang sudah ada (misalnya update ke versi `1.1.0` atau `2.0.0`).

#### 26. `PATCH /game/versions/:versionId/config`
* **Use Case:** Formulir Konfigurasi Game Guru. Dipanggil saat guru menekan tombol "Simpan Konfigurasi" di dashboard template. Data konfigurasi divalidasi di server terhadap JSON Schema template.
* **Request Body:**
  ```json
  {
    "config": {
      "instruction": "Urutkan langkah Bubble Sort berikut secara benar:",
      "items": [
        "Bandingkan elemen bersebelahan",
        "Tukar jika posisi salah",
        "Ulangi penelusuran sampai array terurut"
      ]
    }
  }
  ```
* **Expected Response (`200 OK`):** Mengembalikan versi modul dengan config yang diperbarui.

#### 27. `PUT /game/versions/:versionId/files`
* **Use Case:** Monaco Code Editor (Jalur Developer). Dipanggil saat developer mengedit dan menyimpan kode game custom (tab `index.html`, `style.css`, `script.js`). Guru yang mencoba memanggil endpoint ini akan ditolak dengan `403 FORBIDDEN`.
* **Request Body:**
  ```json
  {
    "files": [
      {
        "relativePath": "index.html",
        "mimeType": "text/html",
        "content": "<!DOCTYPE html><html><body><h1 id='title'>Game Custom</h1></body></html>",
        "isEntrypoint": true
      },
      {
        "relativePath": "style.css",
        "mimeType": "text/css",
        "content": "body { background: #000; color: #fff; }"
      },
      {
        "relativePath": "script.js",
        "mimeType": "application/javascript",
        "content": "console.log('Game custom initialized');"
      }
    ]
  }
  ```
* **Expected Response (`200 OK`):** File tersimpan ke storage dan metadata file terdaftar.

#### 28. `POST /game/versions/:versionId/publish`
* **Use Case:** Tombol "Publikasikan Game". Jika modul berasal dari jalur template, server akan secara otomatis me-*materialize* template engine dan menyuntikkan konfigurasi guru ke dalam bundle file fisik. Setelah published, versi bersifat **immutable** (tidak dapat diubah lagi demi integritas riwayat penilaian siswa).
* **Request Body:**
  ```json
  {
    "maxScore": 100
  }
  ```
* **Expected Response (`200 OK`):** Status versi berubah menjadi `published` dengan `publishedAt` terisi.

#### 29. `GET /game/player/:versionId`
* **Use Case:** **LMS Iframe Runtime.** Dipanggil oleh halaman LMS saat siswa membuka tantangan mini-game. LMS merakit tag `<iframe sandbox="allow-scripts">` menggunakan payload yang didapat dari endpoint ini (`entrypoint`, `baseStorageUrl`, dan daftar source file game).
* **Aturan Akses:** Siswa hanya bisa memuat versi berstatus `published`. Guru dan developer diizinkan memuat versi `draft` untuk fitur **Live Preview** sebelum game dipublikasikan.
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": {
      "versionId": "4a7ef129-87c2-493e-8f31-897bfebc41a2",
      "moduleSlug": "kuis-logika-sorting-array",
      "entrypoint": "index.html",
      "baseStorageUrl": "http://localhost:3000/assets/games/kuis-logika-sorting-array/1.0.0/",
      "maxScore": 100,
      "config": { ... },
      "files": [
        { "relativePath": "index.html", "isEntrypoint": true, "publicUrl": "...", "content": "..." },
        { "relativePath": "style.css", "isEntrypoint": false, "publicUrl": "...", "content": "..." },
        { "relativePath": "script.js", "isEntrypoint": false, "publicUrl": "...", "content": "..." }
      ]
    },
    "meta": { "requestId": "..." }
  }
  ```

---

### DOMAIN 8: AI SERVICE - CODE EVALUATOR & AGENT (`ai-service`)

#### 30. `GET /ai/health`
* **Use Case:** Health check microservice AI via API Gateway.
* **Expected Response (`200 OK`):** `{ "data": { "status": "ok", "service": "ai-service" } }`.

#### 31. `GET /ai/ollama-status`
* **Use Case:** Mengetes apakah backend berhasil tersambung ke Ollama server lokal di port 11434. Digunakan oleh admin panel untuk melihat ketersediaan layanan LLM.
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": {
      "connected": true,
      "url": "http://localhost:11434"
    },
    "meta": { "requestId": "..." }
  }
  ```

#### 32. `POST /ai/generate`
* **Use Case:** Endpoint inferensi umum ke LLM CodeLlama lokal untuk menghasilkan saran materi belajar atau penjabaran soal.
* **Request Body:**
  ```json
  {
    "prompt": "Jelaskan perbedaan mendasar antara Array dan Linked List dalam 2 kalimat ringkas."
  }
  ```
* **Expected Response (`200 OK`):** Mengembalikan string teks balasan dari AI.

#### 33. `POST /ai/submit`
* **Use Case:** **Pemeriksa Kode Otomatis Siswa.** Saat siswa mengetik kode pemrograman pada modul latihan Python/Informatika dan menekan tombol "Uji Kode", endpoint ini mengirim kode siswa, soal, dan expected output ke AI untuk dinilai secara otomatis di 6 dimensi penilaian sekaligus.
* **Headers:** `x-dev-role: student`, `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "soal": "Buat fungsi Python bernama hitung_luas_persegi(sisi) yang mengembalikan luas persegi.",
    "expectedOutput": "hitung_luas_persegi(5) == 25",
    "studentCode": "def hitung_luas_persegi(sisi):\n    return sisi * sisi",
    "hintUsage": 0
  }
  ```
* **Expected Response (`200 OK`):**
  ```json
  {
    "data": {
      "aiScore": {
        "fungsionalitas": 100,
        "logika": 100,
        "syntax": 100,
        "code_style": 95,
        "dokumentasi": 80,
        "konsep": 100
      },
      "overallScore": 95.83,
      "flagOverride": false,
      "aiSuggestion": "Solusi sudah sangat baik, tepat, dan efisien sesuai spesifikasi fungsi.",
      "aiFinishTime": "0h 0m 2s",
      "hintUsage": 0,
      "level": "Expert"
    },
    "meta": { "requestId": "..." }
  }
  ```

---

### DOMAIN 9: PROGRESS & SUBMISSION (`progress-service`)

#### 34. `POST /progress/submissions`
* **Use Case:** Penyimpanan riwayat pengerjaan tantangan/game siswa dan perhitungan perolehan EXP / Streak ke dalam basis data.
* **Status Saat Ini:** Diproteksi autentikasi, mengembalikan status fail-fast **`501 Not Implemented`** dengan aman hingga `progress-service` selesai dikembangkan.
* **Expected Response (`501 Not Implemented`):**
  ```json
  {
    "error": {
      "code": "NOT_IMPLEMENTED",
      "message": "Endpoint submission belum tersedia di progress-service."
    },
    "meta": { "requestId": "..." }
  }
  ```
