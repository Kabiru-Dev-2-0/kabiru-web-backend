import { AssetKind, ContentStatus, type Asset } from '@prisma/client';
import type {
  AssetKindDto,
  AssetSummaryDto,
  ContentStatusDto,
  EducationLevelCode,
  EducationLevelItemDto,
  MaterialListItemDto,
  SubjectItemDto,
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