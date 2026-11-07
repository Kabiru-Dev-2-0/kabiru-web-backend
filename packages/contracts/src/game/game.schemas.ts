import { z } from 'zod';
import { isWithinJsonByteLimit } from '../common/validation';
import { UuidSchema } from '../learning/learning.schemas';

export const MAX_GAME_CONFIG_BYTES = 64 * 1024; // 64 KB batas aman JSONB config
export const MAX_MODULE_VERSION_BYTES = 5 * 1024 * 1024; // 5 MB batas total file per versi modul

export const ModuleSourceSchema = z.enum(['template', 'custom']);
export const VersionStatusSchema = z.enum(['draft', 'published', 'archived']);
export const ModuleStatusSchema = z.enum(['draft', 'active', 'disabled']);

// Proteksi OWASP Path Traversal untuk relativePath (misal: "index.html", "images/fish.png")
export const RelativeFilePathSchema = z
  .string()
  .trim()
  .min(1, 'Path file tidak boleh kosong')
  .max(255, 'Path file maksimal 255 karakter')
  .regex(
    /^[a-zA-Z0-9._/-]+$/,
    'Path file hanya boleh memuat huruf, angka, titik (.), garis bawah (_), minus (-), dan slash (/)',
  )
  .refine((p) => !p.startsWith('/') && !p.endsWith('/'), {
    message: 'Path file harus relatif (tidak boleh diawali atau diakhiri dengan "/")',
  })
  .refine((p) => !p.split('/').some((seg) => seg === '..' || seg === '.' || seg.length === 0), {
    message: 'Path file dilarang memuat segmen traversal (".." atau "//")',
  });

// Skema Manifest Modul (Sesuai PRD Bab 5.1 & 7.1)
export const ManifestSchema = z
  .object({
    schema_version: z.literal(1).default(1),
    name: z
      .string()
      .trim()
      .min(3, 'Nama modul minimal 3 karakter')
      .max(80, 'Nama modul maksimal 80 karakter'),
    slug: z
      .string()
      .trim()
      .min(3, 'Slug minimal 3 karakter')
      .max(100, 'Slug maksimal 100 karakter')
      .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda minus (-)'),
    version: z
      .string()
      .trim()
      .regex(/^\d+\.\d+\.\d+$/, 'Versi harus berformat semver x.y.z (contoh: 1.0.0)'),
    source: ModuleSourceSchema,
    template_id: z.string().trim().min(1).nullable().optional(),
    entry: z
      .object({
        html: RelativeFilePathSchema.default('index.html'),
        css: RelativeFilePathSchema.default('style.css').optional(),
        js: RelativeFilePathSchema.default('script.js').optional(),
      })
      .default({ html: 'index.html', css: 'style.css', js: 'script.js' }),
    max_score: z.number().int().positive().max(1000).default(100),
    config_schema: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((m) => (m.source === 'template') === Boolean(m.template_id), {
    message: 'template_id wajib diisi untuk source=template dan harus kosong untuk source=custom',
    path: ['template_id'],
  });

// ==========================================
// 1. TEMPLATE CATALOG SCHEMAS
// ==========================================

export const ListGameTemplatesQuerySchema = z.object({
  search: z.string().trim().max(100, 'Pencarian maksimal 100 karakter').optional(),
  onlyActive: z.coerce.boolean().default(true),
});

export const GameTemplateIdParamSchema = z.object({
  templateId: z
    .string()
    .trim()
    .min(1, 'templateId wajib diisi')
    .max(50)
    .regex(/^[a-z0-9_-]+$/, 'Format templateId tidak valid'),
});

// ==========================================
// 2. GAME MODULE CRUD SCHEMAS
// ==========================================

export const ListGameModulesQuerySchema = z.object({
  source: ModuleSourceSchema.optional(),
  status: ModuleStatusSchema.optional(),
  search: z.string().trim().max(100, 'Pencarian maksimal 100 karakter').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const GameModuleIdParamSchema = z.object({
  moduleId: UuidSchema,
});

export const CreateGameModuleSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(3, 'Nama modul minimal 3 karakter')
      .max(150, 'Nama modul maksimal 150 karakter'),
    slug: z
      .string()
      .trim()
      .min(3, 'Slug minimal 3 karakter')
      .max(100, 'Slug maksimal 100 karakter')
      .regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan tanda minus (-)')
      .optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    source: ModuleSourceSchema.default('template'),
    templateId: z.string().trim().min(1).nullable().optional(),
  })
  .refine((data) => (data.source === 'template') === Boolean(data.templateId), {
    message: 'templateId wajib diisi untuk source=template dan harus kosong untuk source=custom',
    path: ['templateId'],
  });

export const UpdateGameModuleSchema = z.object({
  name: z.string().trim().min(3).max(150).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  status: ModuleStatusSchema.optional(),
});

export const UpdateGameModulePayloadSchema = GameModuleIdParamSchema.merge(UpdateGameModuleSchema);

// ==========================================
// 3. VERSION & STUDIO AUTHORING SCHEMAS
// ==========================================

export const GameVersionIdParamSchema = z.object({
  versionId: UuidSchema,
});

export const CreateGameVersionDraftSchema = z.object({
  moduleId: UuidSchema,
  version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+\.\d+$/, 'Versi harus berformat semver x.y.z (contoh: 1.0.0)'),
  config: z
    .record(z.string(), z.unknown())
    .default({})
    .refine((val) => isWithinJsonByteLimit(val, MAX_GAME_CONFIG_BYTES), {
      message: 'Ukuran konfigurasi JSON melebihi batas 64 KB',
    }),
});

export const UpdateGameVersionConfigSchema = z.object({
  versionId: UuidSchema,
  config: z
    .record(z.string(), z.unknown())
    .refine((val) => isWithinJsonByteLimit(val, MAX_GAME_CONFIG_BYTES), {
      message: 'Ukuran konfigurasi JSON melebihi batas 64 KB',
    }),
});

export const SaveCustomFileItemSchema = z.object({
  relativePath: RelativeFilePathSchema,
  content: z.string(), // Konten UTF-8 (HTML/CSS/JS/SVG/JSON) atau Base64 jika encoding='base64'
  encoding: z.enum(['utf8', 'base64']).default('utf8'),
  mimeType: z.string().trim().min(1).max(100).default('text/plain'),
  isEntrypoint: z.boolean().default(false),
});

export const SaveCustomFilesPayloadSchema = z.object({
  versionId: UuidSchema,
  manifest: ManifestSchema.optional(),
  files: z
    .array(SaveCustomFileItemSchema)
    .min(1, 'Minimal 1 file harus disertakan')
    .max(50, 'Maksimal 50 file dalam satu versi modul'),
});

export const PublishGameVersionSchema = z.object({
  versionId: UuidSchema,
  maxScore: z.number().int().positive().max(1000).default(100).optional(),
});

// ==========================================
// 4. PLAYER EXECUTION SCHEMA (LMS RUNTIME)
// ==========================================

export const GetGamePlayerPayloadSchema = z.object({
  versionId: UuidSchema,
});

// ==========================================
// EXPORTED INFERRED INPUT TYPES
// ==========================================

export type ManifestDto = z.infer<typeof ManifestSchema>;
export type ListGameTemplatesQueryDto = z.infer<typeof ListGameTemplatesQuerySchema>;
export type GameTemplateIdParamDto = z.infer<typeof GameTemplateIdParamSchema>;
export type ListGameModulesQueryDto = z.infer<typeof ListGameModulesQuerySchema>;
export type GameModuleIdParamDto = z.infer<typeof GameModuleIdParamSchema>;
export type CreateGameModuleDto = z.infer<typeof CreateGameModuleSchema>;
export type UpdateGameModuleDto = z.infer<typeof UpdateGameModuleSchema>;
export type UpdateGameModulePayloadDto = z.infer<typeof UpdateGameModulePayloadSchema>;
export type GameVersionIdParamDto = z.infer<typeof GameVersionIdParamSchema>;
export type CreateGameVersionDraftDto = z.infer<typeof CreateGameVersionDraftSchema>;
export type UpdateGameVersionConfigDto = z.infer<typeof UpdateGameVersionConfigSchema>;
export type SaveCustomFileItemDto = z.infer<typeof SaveCustomFileItemSchema>;
export type SaveCustomFilesPayloadDto = z.infer<typeof SaveCustomFilesPayloadSchema>;
export type PublishGameVersionDto = z.infer<typeof PublishGameVersionSchema>;
export type GetGamePlayerPayloadDto = z.infer<typeof GetGamePlayerPayloadSchema>;
