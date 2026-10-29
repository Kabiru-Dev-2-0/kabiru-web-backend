import { z } from 'zod';
import { EDUCATION_LEVEL_CODES } from '../common/envelope';
import { isWithinJsonByteLimit } from '../common/validation';

export const MAX_JSONB_BYTES = 32 * 1024; // 32 KB
const FORBIDDEN_PUBLIC_PAYLOAD_KEYS = new Set([
  'answer',
  'answer_key',
  'answerKey',
  'correctOptionId',
  'isCorrect',
  'expectedOutput',
]);

export const UuidSchema = z.string().uuid('Format UUID tidak valid');
export const ContentStatusSchema = z.enum(['draft', 'published', 'archived']);
export const QuestionTypeSchema = z.enum([
  'multiple_choice',
  'fill_blank',
  'drag_drop',
  'sorting',
  'true_false',
  'multi_select',
  'pattern_painter',
  'maze_runner',
]);

// Query: GET /learning/subjects?level=SMA&search=...
export const ListSubjectsQuerySchema = z.object({
  level: z.enum(EDUCATION_LEVEL_CODES).default('SMA'),
  search: z.string().trim().max(100, 'Pencarian maksimal 100 karakter').optional(),
});

// Query: GET /learning/topics?level=SMA&subjectId=...&status=...&search=...&page=1&limit=20
export const ListTopicsQuerySchema = z.object({
  level: z.enum(EDUCATION_LEVEL_CODES).default('SMA'),
  subjectId: UuidSchema.optional(),
  status: ContentStatusSchema.optional(),
  search: z.string().trim().max(100, 'Pencarian maksimal 100 karakter').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Query: GET /learning/materials?topicId=...&status=...&page=1&limit=50
export const ListMaterialsQuerySchema = z.object({
  topicId: UuidSchema,
  status: ContentStatusSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const CreateSubjectSchema = z.object({
  educationLevelCode: z.enum(EDUCATION_LEVEL_CODES),
  name: z.string().trim().min(2, 'Nama mata pelajaran minimal 2 karakter').max(150),
});

export const UpdateSubjectSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
});

export const CreateTopicSchema = z.object({
  subjectId: UuidSchema,
  number: z.number().int().min(1, 'Nomor urut minimal 1'),
  title: z.string().trim().min(3, 'Judul topik minimal 3 karakter').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  coverAssetId: UuidSchema.nullable().optional(),
  status: ContentStatusSchema.default('draft'),
});

export const UpdateTopicSchema = CreateTopicSchema.omit({ subjectId: true }).partial();

export const CreateMaterialSchema = z.object({
  topicId: UuidSchema,
  number: z.number().int().min(1, 'Nomor urut minimal 1'),
  title: z.string().trim().min(3, 'Judul materi minimal 3 karakter').max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  learningOutcome: z.string().trim().max(2000).nullable().optional(),
  content: z.string().min(1, 'Konten materi tidak boleh kosong').max(100_000, 'Konten maksimal 100 KB'),
  summary: z.string().trim().max(1000).nullable().optional(),
  coverAssetId: UuidSchema.nullable().optional(),
  status: ContentStatusSchema.default('draft'),
});

export const UpdateMaterialSchema = CreateMaterialSchema.partial();

function containsForbiddenKey(obj: unknown): boolean {
  if (typeof obj !== 'object' || obj === null) return false;
  if (Array.isArray(obj)) return obj.some(containsForbiddenKey);
  for (const [key, val] of Object.entries(obj)) {
    if (FORBIDDEN_PUBLIC_PAYLOAD_KEYS.has(key) || containsForbiddenKey(val)) {
      return true;
    }
  }
  return false;
}

export const TestPublicPayloadSchema = z
  .record(z.string(), z.unknown())
  .refine((val) => isWithinJsonByteLimit(val, MAX_JSONB_BYTES), {
    message: 'Ukuran JSONB payload melebihi batas 32 KB',
  })
  .refine((val) => !containsForbiddenKey(val), {
    message: 'Payload publik dilarang memuat kunci jawaban rahasia',
  });

export const TestAnswerKeySchema = z
  .record(z.string(), z.unknown())
  .refine((val) => isWithinJsonByteLimit(val, MAX_JSONB_BYTES), {
    message: 'Ukuran JSONB answer_key melebihi batas 32 KB',
  });

export type ListSubjectsQueryDto = z.infer<typeof ListSubjectsQuerySchema>;
export type ListTopicsQueryDto = z.infer<typeof ListTopicsQuerySchema>;
export type ListMaterialsQueryDto = z.infer<typeof ListMaterialsQuerySchema>;
export type CreateSubjectDto = z.infer<typeof CreateSubjectSchema>;
export type UpdateSubjectDto = z.infer<typeof UpdateSubjectSchema>;
export type CreateTopicDto = z.infer<typeof CreateTopicSchema>;
export type UpdateTopicDto = z.infer<typeof UpdateTopicSchema>;
export type CreateMaterialDto = z.infer<typeof CreateMaterialSchema>;
export type UpdateMaterialDto = z.infer<typeof UpdateMaterialSchema>;