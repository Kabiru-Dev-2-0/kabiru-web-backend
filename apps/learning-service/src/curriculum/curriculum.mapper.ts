import {
  AssetKind,
  BloomLevel,
  ContentStatus,
  DifficultyType,
  type Asset,
  type Prisma,
} from '@prisma/client';
import type {
  AssetKindDto,
  AssetSummaryDto,
  BloomLevelDto,
  ContentStatusDto,
  DifficultyTypeDto,
  EducationLevelCode,
  EducationLevelItemDto,
  MaterialDetailDto,
  MaterialListItemDto,
  QuestionTypeDto,
  SubjectItemDto,
  TestPublicItemDto,
  TopicItemDto,
} from '@kabiru/contracts';

type AssetRow = Pick<Asset, 'id' | 'kind' | 'storagePath' | 'mimeType' | 'sizeBytes'>;

const CONTENT_STATUS_TO_DTO: Record<ContentStatus, ContentStatusDto> = {
  [ContentStatus.DRAFT]: 'draft',
  [ContentStatus.PUBLISHED]: 'published',
  [ContentStatus.ARCHIVED]: 'archived',
};

const CONTENT_STATUS_FROM_DTO: Record<ContentStatusDto, ContentStatus> = {
  draft: ContentStatus.DRAFT,
  published: ContentStatus.PUBLISHED,
  archived: ContentStatus.ARCHIVED,
};

const ASSET_KIND_TO_DTO: Record<AssetKind, AssetKindDto> = {
  [AssetKind.IMAGE]: 'image',
  [AssetKind.AUDIO]: 'audio',
  [AssetKind.SCRIPT]: 'script',
  [AssetKind.BUNDLE]: 'bundle',
  [AssetKind.DOCUMENT]: 'document',
};

const DIFFICULTY_TO_DTO: Record<DifficultyType, DifficultyTypeDto> = {
  [DifficultyType.EASY]: 'easy',
  [DifficultyType.MEDIUM]: 'medium',
  [DifficultyType.HARD]: 'hard',
};

const BLOOM_LEVEL_TO_DTO: Record<BloomLevel, BloomLevelDto> = {
  [BloomLevel.REMEMBER]: 'remember',
  [BloomLevel.UNDERSTAND]: 'understand',
  [BloomLevel.APPLY]: 'apply',
  [BloomLevel.ANALYZE]: 'analyze',
  [BloomLevel.EVALUATE]: 'evaluate',
  [BloomLevel.CREATE]: 'create',
};

const FORBIDDEN_PUBLIC_KEYS = new Set([
  'answer',
  'answer_key',
  'answerKey',
  'correctOptionId',
  'isCorrect',
  'expectedOutput',
]);

function stripForbiddenKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stripForbiddenKeys);
  }
  if (typeof value === 'object' && value !== null) {
    const cleaned: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (!FORBIDDEN_PUBLIC_KEYS.has(key)) {
        cleaned[key] = stripForbiddenKeys(val);
      }
    }
    return cleaned;
  }
  return value;
}

export function sanitizePublicPayload(
  payload: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return null;
  }
  return stripForbiddenKeys(payload) as Record<string, unknown>;
}

export function toContentStatusDto(status: ContentStatus): ContentStatusDto {
  return CONTENT_STATUS_TO_DTO[status];
}

export function toContentStatusPrisma(status: ContentStatusDto): ContentStatus {
  return CONTENT_STATUS_FROM_DTO[status];
}

export function toAssetSummaryDto(asset: AssetRow | null): AssetSummaryDto | null {
  if (!asset) return null;
  return {
    id: asset.id,
    kind: ASSET_KIND_TO_DTO[asset.kind],
    storagePath: asset.storagePath,
    mimeType: asset.mimeType,
    sizeBytes: Number(asset.sizeBytes),
  };
}

export function toEducationLevelItemDto(row: {
  id: string;
  code: string;
  name: string;
}): EducationLevelItemDto {
  return {
    id: row.id,
    code: row.code as EducationLevelCode,
    name: row.name,
  };
}

export function toSubjectItemDto(row: {
  id: string;
  educationLevelId: string;
  name: string;
  educationLevel: { code: string };
  _count: { topics: number };
}): SubjectItemDto {
  return {
    id: row.id,
    educationLevelId: row.educationLevelId,
    educationLevelCode: row.educationLevel.code as EducationLevelCode,
    name: row.name,
    publishedTopicCount: row._count.topics,
  };
}

export function toTopicItemDto(row: {
  id: string;
  subjectId: string;
  number: number;
  title: string;
  description: string | null;
  status: ContentStatus;
  subject: { name: string };
  coverAsset: AssetRow | null;
  _count: { materials: number };
}): TopicItemDto {
  return {
    id: row.id,
    subjectId: row.subjectId,
    subjectName: row.subject.name,
    number: row.number,
    title: row.title,
    description: row.description,
    coverAsset: toAssetSummaryDto(row.coverAsset),
    status: toContentStatusDto(row.status),
    publishedMaterialCount: row._count.materials,
  };
}

export function toMaterialListItemDto(row: {
  id: string;
  topicId: string;
  number: number;
  title: string;
  description: string | null;
  learningOutcome: string | null;
  summary: string | null;
  status: ContentStatus;
  updatedAt: Date;
  coverAsset: AssetRow | null;
  _count: { tests: number };
}): MaterialListItemDto {
  return {
    id: row.id,
    topicId: row.topicId,
    number: row.number,
    title: row.title,
    description: row.description,
    learningOutcome: row.learningOutcome,
    summary: row.summary,
    coverAsset: toAssetSummaryDto(row.coverAsset),
    status: toContentStatusDto(row.status),
    publishedTestCount: row._count.tests,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface TestPublicRow {
  id: string;
  number: number;
  title: string;
  questionType: string;
  prompt: string;
  points: number;
  difficulty: DifficultyType;
  bloomLevel: BloomLevel;
  maxAttempts: number | null;
  gameModuleVersionId: string | null;
  payload: Prisma.JsonValue | null;
  testCases: Array<{
    id: string;
    input: string;
    expectedOutput: string;
  }>;
}

export interface MaterialDetailRow {
  id: string;
  number: number;
  title: string;
  description: string | null;
  learningOutcome: string | null;
  content: string;
  summary: string | null;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
  coverAsset: AssetRow | null;
  topic: {
    id: string;
    number: number;
    title: string;
    subject: {
      id: string;
      name: string;
      educationLevel: {
        code: string;
      };
    };
  };
  tests: TestPublicRow[];
}

export function toTestPublicItemDto(row: TestPublicRow): TestPublicItemDto {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    questionType: row.questionType as QuestionTypeDto,
    prompt: row.prompt,
    points: row.points,
    difficulty: DIFFICULTY_TO_DTO[row.difficulty],
    bloomLevel: BLOOM_LEVEL_TO_DTO[row.bloomLevel],
    maxAttempts: row.maxAttempts,
    gameModuleVersionId: row.gameModuleVersionId,
    payload: sanitizePublicPayload(row.payload),
    sampleTestCases: row.testCases.map((tc) => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
    })),
  };
}

export function toMaterialDetailDto(
  row: MaterialDetailRow,
  navigation: { previousMaterialId: string | null; nextMaterialId: string | null },
): MaterialDetailDto {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    description: row.description,
    learningOutcome: row.learningOutcome,
    content: row.content,
    summary: row.summary,
    coverAsset: toAssetSummaryDto(row.coverAsset),
    status: toContentStatusDto(row.status),
    breadcrumb: {
      educationLevelCode: row.topic.subject.educationLevel.code,
      subjectId: row.topic.subject.id,
      subjectName: row.topic.subject.name,
      topicId: row.topic.id,
      topicNumber: row.topic.number,
      topicTitle: row.topic.title,
    },
    navigation,
    tests: row.tests.map(toTestPublicItemDto),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}