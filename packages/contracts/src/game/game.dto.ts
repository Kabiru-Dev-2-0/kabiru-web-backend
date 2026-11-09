import type { ManifestDto } from './game.schemas';

export type ModuleSourceDto = 'template' | 'custom';
export type VersionStatusDto = 'draft' | 'published' | 'archived';
export type ModuleStatusDto = 'draft' | 'active' | 'disabled';

// 1. Template Catalog DTOs
export interface GameTemplateListItemDto {
  id: string;
  name: string;
  description: string | null;
  configSchema: Record<string, unknown>;
  defaultConfig: Record<string, unknown>;
  isActive: boolean;
}

export interface GameTemplateDetailDto extends GameTemplateListItemDto {
  createdAt: string;
}

// 2. Game Module CRUD DTOs
export interface GameModuleListItemDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  source: ModuleSourceDto;
  templateId: string | null;
  templateName: string | null;
  status: ModuleStatusDto;
  createdBy: string;
  latestVersion: string | null;
  latestVersionStatus: VersionStatusDto | null;
  publishedVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GameModuleVersionSummaryDto {
  id: string;
  version: string;
  status: VersionStatusDto;
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
}

export interface GameModuleDetailDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  source: ModuleSourceDto;
  templateId: string | null;
  templateName: string | null;
  status: ModuleStatusDto;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  versions: GameModuleVersionSummaryDto[];
}

// 3. Version & Authoring Studio DTOs
export interface GameModuleFileItemDto {
  id: string;
  assetId: string;
  relativePath: string;
  isEntrypoint: boolean;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storagePath: string;
  publicUrl?: string;
  content?: string; // Diisi untuk text files (HTML/CSS/JS) saat dibuka di Monaco Editor
}

export interface GameModuleVersionDetailDto {
  id: string;
  gameModuleId: string;
  moduleSlug: string;
  moduleName: string;
  source: ModuleSourceDto;
  templateId: string | null;
  version: string;
  status: VersionStatusDto;
  config: Record<string, unknown>;
  manifest: ManifestDto | Record<string, unknown> | null;
  checksumSha256: string | null;
  storagePrefix: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
  files: GameModuleFileItemDto[];
}

// 4. Player Execution DTO (LMS Iframe Runtime)
export interface GamePlayerPayloadDto {
  versionId: string;
  gameModuleId: string;
  moduleSlug: string;
  moduleName: string;
  version: string;
  source: ModuleSourceDto;
  entrypoint: string; // e.g. "index.html"
  baseStorageUrl: string; // URL direktori R2 untuk <base href="...">
  config: Record<string, unknown>;
  maxScore: number;
  manifest: ManifestDto | Record<string, unknown>;
  files: Array<{
    relativePath: string;
    isEntrypoint: boolean;
    mimeType: string;
    publicUrl: string;
    content?: string; // Entrypoint HTML/CSS/JS untuk perakitan srcdoc
  }>;
}
