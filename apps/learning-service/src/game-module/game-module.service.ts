import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  ModuleSource,
  ModuleStatus,
  Prisma,
  VersionStatus,
  type Asset,
  type GameModule,
  type GameModuleFile,
  type GameModuleVersion,
  type GameTemplate,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  HexColorSchema,
  MAX_MODULE_VERSION_BYTES,
  ManifestSchema,
  createServiceError,
  type ActorContext,
  type CreateGameModuleDto,
  type CreateGameVersionDraftDto,
  type GameModuleDetailDto,
  type GameModuleIdParamDto,
  type GameModuleListItemDto,
  type GameModuleVersionDetailDto,
  type GamePlayerPayloadDto,
  type GameTemplateDetailDto,
  type GameTemplateIdParamDto,
  type GameTemplateListItemDto,
  type GameVersionIdParamDto,
  type GetGamePlayerPayloadDto,
  type ListGameModulesQueryDto,
  type ListGameTemplatesQueryDto,
  type ModuleSourceDto,
  type ModuleStatusDto,
  type MutationResultDto,
  type PublishGameVersionDto,
  type SaveCustomFilesPayloadDto,
  type UpdateGameModulePayloadDto,
  type UpdateGameVersionConfigDto,
  type VersionStatusDto,
} from '@kabiru/contracts';
import { assertAuthorRole } from '../common/rpc-validation.util';
import type { PaginatedResult } from '../curriculum/curriculum.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssetService } from '../storage/asset.service';
import { R2StorageService } from '../storage/r2-storage.service';
import {
  buildBlankCustomStarterFiles,
  materializeTemplateFiles,
  resolveTemplateStarterFiles,
  toStudioFilesArray,
  type MaterializedTemplateFile,
} from './templates/template-engine.registry';

const PRISMA_TO_DTO_SOURCE: Record<ModuleSource, ModuleSourceDto> = {
  [ModuleSource.TEMPLATE]: 'template',
  [ModuleSource.CUSTOM]: 'custom',
};

const DTO_TO_PRISMA_SOURCE: Record<ModuleSourceDto, ModuleSource> = {
  template: ModuleSource.TEMPLATE,
  custom: ModuleSource.CUSTOM,
};

const PRISMA_TO_DTO_MODULE_STATUS: Record<ModuleStatus, ModuleStatusDto> = {
  [ModuleStatus.DRAFT]: 'draft',
  [ModuleStatus.ACTIVE]: 'active',
  [ModuleStatus.DISABLED]: 'disabled',
};

const DTO_TO_PRISMA_MODULE_STATUS: Record<ModuleStatusDto, ModuleStatus> = {
  draft: ModuleStatus.DRAFT,
  active: ModuleStatus.ACTIVE,
  disabled: ModuleStatus.DISABLED,
};

const PRISMA_TO_DTO_VERSION_STATUS: Record<VersionStatus, VersionStatusDto> = {
  [VersionStatus.DRAFT]: 'draft',
  [VersionStatus.PUBLISHED]: 'published',
  [VersionStatus.ARCHIVED]: 'archived',
};

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function asRecord(val: unknown): Record<string, unknown> {
  if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
    return val as Record<string, unknown>;
  }
  return {};
}

function isTextFile(mimeType: string, relativePath: string): boolean {
  const lowerMime = mimeType.toLowerCase();
  const lowerPath = relativePath.toLowerCase();
  return (
    lowerMime.startsWith('text/') ||
    lowerMime.includes('javascript') ||
    lowerMime.includes('json') ||
    lowerMime.includes('svg') ||
    /\.(html|css|js|mjs|json|svg|txt)$/.test(lowerPath)
  );
}

type VersionWithRelations = GameModuleVersion & {
  gameModule: GameModule & { template: GameTemplate | null };
  files: Array<GameModuleFile & { asset: Asset }>;
};

@Injectable()
export class GameModuleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetService: AssetService,
    private readonly r2Storage: R2StorageService,
  ) {}

  private assertModuleAccess(mod: { createdBy: string }, actor: ActorContext): void {
    if (actor.role === 'teacher' && mod.createdBy !== actor.userId) {
      throw new RpcException(
        createServiceError({
          code: 'FORBIDDEN',
          httpStatus: 403,
          message: 'Guru hanya diizinkan mengakses dan mengubah modul buatannya sendiri.',
        }),
      );
    }
  }

private async seedVersionStarterFiles(
  versionId: string,
  storagePrefix: string,
  files: MaterializedTemplateFile[],
  uploadedBy: string,
): Promise<void> {
  for (const f of files) {
    const asset = await this.assetService.uploadAndUpsertAsset({
      storagePath: `${storagePrefix}/${f.relativePath}`,
      buffer: Buffer.from(f.content, 'utf8'),
      mimeType: f.mimeType,
      uploadedBy,
    });
    await this.prisma.gameModuleFile.upsert({
      where: {
        gameModuleVersionId_relativePath: { gameModuleVersionId: versionId, relativePath: f.relativePath },
      },
      update: { assetId: asset.id, isEntrypoint: f.isEntrypoint },
      create: {
        gameModuleVersionId: versionId,
        assetId: asset.id,
        relativePath: f.relativePath,
        isEntrypoint: f.isEntrypoint,
      },
    });
  }
}

private async sanitizeAndResolveConfig(rawConfig: Record<string, unknown>): Promise<Record<string, unknown>> {
  const next = { ...rawConfig };

  // 1. Validasi seluruh warna di config.theme menggunakan HexColorSchema (FR-27)
  if (next.theme && typeof next.theme === 'object' && !Array.isArray(next.theme)) {
    for (const [key, val] of Object.entries(next.theme as Record<string, unknown>)) {
      if (val !== null && val !== undefined && !HexColorSchema.safeParse(val).success) {
        throw new RpcException(
          createServiceError({
            code: 'VALIDATION_ERROR',
            httpStatus: 400,
            message: `Nilai warna '${key}' tidak valid. Gunakan format Hex (#RRGGBB).`,
          }),
        );
      }
    }
  }

  // 2. Resolusi config.assets[slot].assetId ke publicUrl R2 resmi milik sistem (OWASP A10)
  if (next.assets && typeof next.assets === 'object' && !Array.isArray(next.assets)) {
    const resolvedAssets: Record<string, unknown> = {};
    for (const [slot, val] of Object.entries(next.assets as Record<string, unknown>)) {
      if (!val || typeof val !== 'object') {
        resolvedAssets[slot] = null;
        continue;
      }
      const assetId = (val as Record<string, unknown>).assetId;
      if (typeof assetId !== 'string') {
        resolvedAssets[slot] = null;
        continue;
      }
      const assetRow = await this.prisma.asset.findUnique({ where: { id: assetId } });
      if (!assetRow) {
        throw new RpcException(
          createServiceError({
            code: 'VALIDATION_ERROR',
            httpStatus: 400,
            message: `Asset pada slot '${slot}' tidak ditemukan di penyimpanan KABIRU.`,
          }),
        );
      }
      resolvedAssets[slot] = {
        assetId: assetRow.id,
        url: this.r2Storage.getPublicUrl(assetRow.storagePath),
      };
    }
    next.assets = resolvedAssets;
  }

  return next;
}

  // ==========================================
  // 1. TEMPLATE CATALOG
  // ==========================================

  async listTemplates(query: ListGameTemplatesQueryDto): Promise<GameTemplateListItemDto[]> {
    const where: Prisma.GameTemplateWhereInput = {
      ...(query.onlyActive ? { isActive: true } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const rows = await this.prisma.gameTemplate.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      configSchema: asRecord(row.configSchema),
      defaultConfig: asRecord(row.defaultConfig),
      isActive: row.isActive,
    }));
  }

  async getTemplateDetail(params: GameTemplateIdParamDto): Promise<GameTemplateDetailDto> {
    const row = await this.prisma.gameTemplate.findUnique({
      where: { id: params.templateId },
    });

    if (!row) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: `Template '${params.templateId}' tidak ditemukan.`,
        }),
      );
    }

    const rawStarter = (row as unknown as Record<string, unknown>).starterFiles;
    const starterFiles = await resolveTemplateStarterFiles(row.id, asRecord(rawStarter));

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      configSchema: asRecord(row.configSchema),
      defaultConfig: asRecord(row.defaultConfig),
      starterFiles,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
    };
  }

  // ==========================================
  // 2. GAME MODULE CRUD
  // ==========================================

  async listModules(
    query: ListGameModulesQueryDto,
    actor: ActorContext | null,
  ): Promise<PaginatedResult<GameModuleListItemDto>> {
    const author = assertAuthorRole(actor);
    const skip = (query.page - 1) * query.limit;

    const where: Prisma.GameModuleWhereInput = {
      deletedAt: null,
      // FR-17: Guru hanya melihat modul miliknya sendiri
      ...(author.role === 'teacher' ? { createdBy: author.userId } : {}),
      ...(query.source ? { source: DTO_TO_PRISMA_SOURCE[query.source] } : {}),
      ...(query.status ? { status: DTO_TO_PRISMA_MODULE_STATUS[query.status] } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { slug: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, totalItems] = await Promise.all([
      this.prisma.gameModule.findMany({
        where,
        include: {
          template: { select: { name: true } },
          versions: {
            orderBy: { createdAt: 'desc' },
            select: { id: true, version: true, status: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.gameModule.count({ where }),
    ]);

    const items: GameModuleListItemDto[] = rows.map((row) => {
      const latest = row.versions[0] ?? null;
      const published = row.versions.find((v) => v.status === VersionStatus.PUBLISHED) ?? null;

      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        source: PRISMA_TO_DTO_SOURCE[row.source],
        templateId: row.templateId,
        templateName: row.template?.name ?? null,
        status: PRISMA_TO_DTO_MODULE_STATUS[row.status],
        createdBy: row.createdBy,
        latestVersion: latest?.version ?? null,
        latestVersionStatus: latest ? PRISMA_TO_DTO_VERSION_STATUS[latest.status] : null,
        publishedVersionId: published?.id ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      };
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / query.limit));
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages,
      },
    };
  }

  async getModuleDetail(
    params: GameModuleIdParamDto,
    actor: ActorContext | null,
  ): Promise<GameModuleDetailDto> {
    const author = assertAuthorRole(actor);

    const row = await this.prisma.gameModule.findFirst({
      where: { id: params.moduleId, deletedAt: null },
      include: {
        template: { select: { name: true } },
        versions: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!row) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Modul game tidak ditemukan.',
        }),
      );
    }

    this.assertModuleAccess(row, author);

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      source: PRISMA_TO_DTO_SOURCE[row.source],
      templateId: row.templateId,
      templateName: row.template?.name ?? null,
      status: PRISMA_TO_DTO_MODULE_STATUS[row.status],
      createdBy: row.createdBy,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      versions: row.versions.map((v) => ({
        id: v.id,
        version: v.version,
        status: PRISMA_TO_DTO_VERSION_STATUS[v.status],
        publishedAt: v.publishedAt?.toISOString() ?? null,
        publishedBy: v.publishedBy,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  }

  async createModule(
    dto: CreateGameModuleDto,
    actor: ActorContext | null,
  ): Promise<GameModuleDetailDto> {
    // FR-20b: Guru, Developer, dan Admin dapat memilih jalur template maupun custom
    const author = assertAuthorRole(actor);

    let initialConfig: Record<string, unknown> = {};
    let templateRecord: GameTemplate | null = null;
    if (dto.source === 'template' && dto.templateId) {
      const template = await this.prisma.gameTemplate.findUnique({
        where: { id: dto.templateId },
      });
      if (!template || !template.isActive) {
        throw new RpcException(
          createServiceError({
            code: 'NOT_FOUND',
            httpStatus: 404,
            message: `Template '${dto.templateId}' tidak ditemukan atau tidak aktif.`,
          }),
        );
      }
      templateRecord = template;
      initialConfig = asRecord(template.defaultConfig);
    }

    const baseSlug = dto.slug ? dto.slug : toSlug(dto.name);
    const existingSlug = await this.prisma.gameModule.findUnique({
      where: { slug: baseSlug },
    });
    const finalSlug = existingSlug ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

    const created = await this.prisma.gameModule.create({
      data: {
        name: dto.name,
        slug: finalSlug,
        description: dto.description ?? null,
        source: DTO_TO_PRISMA_SOURCE[dto.source],
        templateId: dto.source === 'template' ? (dto.templateId ?? null) : null,
        status: ModuleStatus.DRAFT,
        createdBy: author.userId,
        versions: {
          create: {
            version: '1.0.0',
            status: VersionStatus.DRAFT,
            config: initialConfig as Prisma.InputJsonValue,
            storagePrefix: `games/${finalSlug}/1.0.0`,
            manifest: {
              schema_version: 1,
              name: dto.name,
              slug: finalSlug,
              version: '1.0.0',
              source: dto.source,
              template_id: dto.source === 'template' ? dto.templateId : null,
              entry: { html: 'index.html', css: 'style.css', js: 'script.js' },
              max_score: 100,
              custom_result_screen: false,
            } as Prisma.InputJsonValue,
          },
        },
      },
      include: {
        template: { select: { name: true } },
        versions: { orderBy: { createdAt: 'desc' } },
      },
    });

    const firstVersion = created.versions[0];
    if (firstVersion) {
      const storagePrefix = firstVersion.storagePrefix ?? `games/${finalSlug}/1.0.0`;
      const rawStarter = (templateRecord as unknown as Record<string, unknown> | null)?.starterFiles;
      const initialFiles =
        dto.source === 'template' && dto.templateId
          ? toStudioFilesArray(await resolveTemplateStarterFiles(dto.templateId, asRecord(rawStarter)))
          : buildBlankCustomStarterFiles(dto.name);

      await this.seedVersionStarterFiles(firstVersion.id, storagePrefix, initialFiles, author.userId);
    }

    return {
      id: created.id,
      slug: created.slug,
      name: created.name,
      description: created.description,
      source: PRISMA_TO_DTO_SOURCE[created.source],
      templateId: created.templateId,
      templateName: created.template?.name ?? null,
      status: PRISMA_TO_DTO_MODULE_STATUS[created.status],
      createdBy: created.createdBy,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      versions: created.versions.map((v) => ({
        id: v.id,
        version: v.version,
        status: PRISMA_TO_DTO_VERSION_STATUS[v.status],
        publishedAt: v.publishedAt?.toISOString() ?? null,
        publishedBy: v.publishedBy,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  }

  async updateModule(
    dto: UpdateGameModulePayloadDto,
    actor: ActorContext | null,
  ): Promise<GameModuleDetailDto> {
    const author = assertAuthorRole(actor);

    const existing = await this.prisma.gameModule.findFirst({
      where: { id: dto.moduleId, deletedAt: null },
    });

    if (!existing) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Modul game tidak ditemukan.',
        }),
      );
    }

    this.assertModuleAccess(existing, author);

    await this.prisma.gameModule.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: DTO_TO_PRISMA_MODULE_STATUS[dto.status] } : {}),
      },
    });

    return this.getModuleDetail({ moduleId: existing.id }, author);
  }

  async deleteModule(
    params: GameModuleIdParamDto,
    actor: ActorContext | null,
  ): Promise<MutationResultDto> {
    const author = assertAuthorRole(actor);

    const existing = await this.prisma.gameModule.findFirst({
      where: { id: params.moduleId, deletedAt: null },
    });

    if (!existing) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Modul game tidak ditemukan.',
        }),
      );
    }

    this.assertModuleAccess(existing, author);

    await this.prisma.gameModule.update({
      where: { id: existing.id },
      data: {
        deletedAt: new Date(),
        status: ModuleStatus.DISABLED,
      },
    });

    return {
      success: true,
      id: existing.id,
      message: 'Modul game berhasil dihapus (soft-delete).',
    };
  }

  // ==========================================
  // 3. VERSIONING & STUDIO AUTHORING
  // ==========================================

  private async mapVersionDetail(
    row: VersionWithRelations,
    includeTextContent: boolean,
  ): Promise<GameModuleVersionDetailDto> {
    const files = await Promise.all(
      row.files.map(async (f) => {
        const content =
          includeTextContent && isTextFile(f.asset.mimeType, f.relativePath)
            ? ((await this.r2Storage.getObjectText(f.asset.storagePath)) ?? undefined)
            : undefined;

        return {
          id: f.id,
          assetId: f.assetId,
          relativePath: f.relativePath,
          isEntrypoint: f.isEntrypoint,
          mimeType: f.asset.mimeType,
          sizeBytes: Number(f.asset.sizeBytes),
          sha256: f.asset.sha256,
          storagePath: f.asset.storagePath,
          publicUrl: this.r2Storage.getPublicUrl(f.asset.storagePath),
          content,
        };
      }),
    );

    return {
      id: row.id,
      gameModuleId: row.gameModuleId,
      moduleSlug: row.gameModule.slug,
      moduleName: row.gameModule.name,
      source: PRISMA_TO_DTO_SOURCE[row.gameModule.source],
      templateId: row.gameModule.templateId,
      version: row.version,
      status: PRISMA_TO_DTO_VERSION_STATUS[row.status],
      config: asRecord(row.config),
      manifest: row.manifest ? asRecord(row.manifest) : null,
      checksumSha256: row.checksumSha256,
      storagePrefix: row.storagePrefix,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      publishedBy: row.publishedBy,
      createdAt: row.createdAt.toISOString(),
      files,
    };
  }

  async createVersionDraft(
    dto: CreateGameVersionDraftDto,
    actor: ActorContext | null,
  ): Promise<GameModuleVersionDetailDto> {
    const author = assertAuthorRole(actor);

    const mod = await this.prisma.gameModule.findFirst({
      where: { id: dto.moduleId, deletedAt: null },
      include: { template: true },
    });

    if (!mod) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Modul game tidak ditemukan.',
        }),
      );
    }

    this.assertModuleAccess(mod, author);

    const duplicate = await this.prisma.gameModuleVersion.findUnique({
      where: {
        gameModuleId_version: {
          gameModuleId: mod.id,
          version: dto.version,
        },
      },
    });

    if (duplicate) {
      throw new RpcException(
        createServiceError({
          code: 'CONFLICT',
          httpStatus: 409,
          message: `Versi '${dto.version}' sudah ada pada modul ini.`,
        }),
      );
    }

    const storagePrefix = `games/${mod.slug}/${dto.version}`;
    const sourceDto = PRISMA_TO_DTO_SOURCE[mod.source];
    const cleanConfig = await this.sanitizeAndResolveConfig(dto.config);

    const created = await this.prisma.gameModuleVersion.create({
      data: {
        gameModuleId: mod.id,
        version: dto.version,
        status: VersionStatus.DRAFT,
        config: cleanConfig as Prisma.InputJsonValue,
        storagePrefix,
        manifest: {
          schema_version: 1,
          name: mod.name,
          slug: mod.slug,
          version: dto.version,
          source: sourceDto,
          template_id: mod.templateId,
          entry: { html: 'index.html', css: 'style.css', js: 'script.js' },
          max_score: 100,
          custom_result_screen: false,
        } as Prisma.InputJsonValue,
      },
      include: {
        gameModule: { include: { template: true } },
        files: { include: { asset: true } },
      },
    });

    const rawStarter = (mod.template as unknown as Record<string, unknown> | null)?.starterFiles;
    const initialFiles =
      mod.source === ModuleSource.TEMPLATE && mod.templateId
        ? toStudioFilesArray(await resolveTemplateStarterFiles(mod.templateId, asRecord(rawStarter)))
        : buildBlankCustomStarterFiles(mod.name);

    await this.seedVersionStarterFiles(created.id, storagePrefix, initialFiles, author.userId);
    return this.getVersionDetail({ versionId: created.id }, author);
  }

  async getVersionDetail(
    params: GameVersionIdParamDto,
    actor: ActorContext | null,
  ): Promise<GameModuleVersionDetailDto> {
    const author = assertAuthorRole(actor);

    const row = await this.prisma.gameModuleVersion.findUnique({
      where: { id: params.versionId },
      include: {
        gameModule: { include: { template: true } },
        files: { include: { asset: true }, orderBy: { relativePath: 'asc' } },
      },
    });

    if (!row || row.gameModule.deletedAt !== null) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Versi modul game tidak ditemukan.',
        }),
      );
    }

    this.assertModuleAccess(row.gameModule, author);
    return this.mapVersionDetail(row, true);
  }

  async updateVersionConfig(
    dto: UpdateGameVersionConfigDto,
    actor: ActorContext | null,
  ): Promise<GameModuleVersionDetailDto> {
    const author = assertAuthorRole(actor);

    const row = await this.prisma.gameModuleVersion.findUnique({
      where: { id: dto.versionId },
      include: { gameModule: { include: { template: true } } },
    });

    if (!row || row.gameModule.deletedAt !== null) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Versi modul game tidak ditemukan.',
        }),
      );
    }

    this.assertModuleAccess(row.gameModule, author);

    // FR-06: Versi published bersifat immutable
    if (row.status !== VersionStatus.DRAFT) {
      throw new RpcException(
        createServiceError({
          code: 'CONFLICT',
          httpStatus: 409,
          message: 'Versi yang sudah dipublikasikan tidak dapat diubah (immutable).',
        }),
      );
    }

    const cleanConfig = await this.sanitizeAndResolveConfig(dto.config);

    const updated = await this.prisma.gameModuleVersion.update({
      where: { id: row.id },
      data: {
        config: cleanConfig as Prisma.InputJsonValue,
      },
      include: {
        gameModule: { include: { template: true } },
        files: { include: { asset: true }, orderBy: { relativePath: 'asc' } },
      },
    });

    return this.mapVersionDetail(updated, true);
  }

  async saveCustomFiles(
    dto: SaveCustomFilesPayloadDto,
    actor: ActorContext | null,
  ): Promise<GameModuleVersionDetailDto> {
    const author = assertAuthorRole(actor);

    const row = await this.prisma.gameModuleVersion.findUnique({
      where: { id: dto.versionId },
      include: { gameModule: { include: { template: true } } },
    });

    if (!row || row.gameModule.deletedAt !== null) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Versi modul game tidak ditemukan.',
        }),
      );
    }

    // FR-20b & FR-20c: Guru, Developer, dan Admin dapat mengedit berkas versi di Monaco selama modul miliknya sendiri
    this.assertModuleAccess(row.gameModule, author);

    if (row.status !== VersionStatus.DRAFT) {
      throw new RpcException(
        createServiceError({
          code: 'CONFLICT',
          httpStatus: 409,
          message: 'Versi yang sudah dipublikasikan tidak dapat diubah (immutable).',
        }),
      );
    }

    const decodedFiles = dto.files.map((f) => {
      const buffer =
        f.encoding === 'base64'
          ? Buffer.from(f.content, 'base64')
          : Buffer.from(f.content, 'utf8');
      return {
        ...f,
        buffer,
      };
    });

    const totalBatchBytes = decodedFiles.reduce((acc, f) => acc + f.buffer.byteLength, 0);
    if (totalBatchBytes > MAX_MODULE_VERSION_BYTES) {
      throw new RpcException(
        createServiceError({
          code: 'PAYLOAD_TOO_LARGE',
          httpStatus: 413,
          message: `Total ukuran file (${totalBatchBytes} bytes) melebihi batas kuota versi (${MAX_MODULE_VERSION_BYTES} bytes).`,
        }),
      );
    }

    const storagePrefix = row.storagePrefix ?? `games/${row.gameModule.slug}/${row.version}`;

    for (const fileItem of decodedFiles) {
      const storagePath = `${storagePrefix}/${fileItem.relativePath}`;
      const asset = await this.assetService.uploadAndUpsertAsset({
        storagePath,
        buffer: fileItem.buffer,
        mimeType: fileItem.mimeType,
        uploadedBy: author.userId,
      });

      const isEntrypoint = fileItem.isEntrypoint || fileItem.relativePath === 'index.html';

      await this.prisma.gameModuleFile.upsert({
        where: {
          gameModuleVersionId_relativePath: {
            gameModuleVersionId: row.id,
            relativePath: fileItem.relativePath,
          },
        },
        update: {
          assetId: asset.id,
          isEntrypoint,
        },
        create: {
          gameModuleVersionId: row.id,
          assetId: asset.id,
          relativePath: fileItem.relativePath,
          isEntrypoint,
        },
      });
    }

    if (dto.manifest) {
      await this.prisma.gameModuleVersion.update({
        where: { id: row.id },
        data: {
          storagePrefix,
          manifest: dto.manifest as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return this.getVersionDetail({ versionId: row.id }, author);
  }

  async resetTemplateFiles(
    params: GameVersionIdParamDto,
    actor: ActorContext | null,
  ): Promise<GameModuleVersionDetailDto> {
    const author = assertAuthorRole(actor);

    const row = await this.prisma.gameModuleVersion.findUnique({
      where: { id: params.versionId },
      include: { gameModule: { include: { template: true } } },
    });

    if (!row || row.gameModule.deletedAt !== null) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Versi modul game tidak ditemukan.',
        }),
      );
    }

    this.assertModuleAccess(row.gameModule, author);

    if (row.status !== VersionStatus.DRAFT) {
      throw new RpcException(
        createServiceError({
          code: 'CONFLICT',
          httpStatus: 409,
          message: 'Hanya versi berstatus DRAFT yang dapat di-reset ke starter code template.',
        }),
      );
    }

    if (row.gameModule.source !== ModuleSource.TEMPLATE || !row.gameModule.templateId) {
      throw new RpcException(
        createServiceError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'Fitur reset starter code hanya berlaku untuk modul berbasis template.',
        }),
      );
    }

    const storagePrefix = row.storagePrefix ?? `games/${row.gameModule.slug}/${row.version}`;
    const rawStarter = (row.gameModule.template as unknown as Record<string, unknown> | null)?.starterFiles;
    const starterFiles = toStudioFilesArray(
      await resolveTemplateStarterFiles(row.gameModule.templateId, asRecord(rawStarter)),
    );

    await this.seedVersionStarterFiles(row.id, storagePrefix, starterFiles, author.userId);
    return this.getVersionDetail({ versionId: row.id }, author);
  }

  async publishVersion(
    dto: PublishGameVersionDto,
    actor: ActorContext | null,
  ): Promise<GameModuleVersionDetailDto> {
    const author = assertAuthorRole(actor);

    const row = await this.prisma.gameModuleVersion.findUnique({
      where: { id: dto.versionId },
      include: {
        gameModule: { include: { template: true } },
        files: { include: { asset: true } },
      },
    });

    if (!row || row.gameModule.deletedAt !== null) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Versi modul game tidak ditemukan.',
        }),
      );
    }

    this.assertModuleAccess(row.gameModule, author);

    if (row.status !== VersionStatus.DRAFT) {
      throw new RpcException(
        createServiceError({
          code: 'CONFLICT',
          httpStatus: 409,
          message: 'Versi ini sudah dipublikasikan atau diarsipkan sebelumnya.',
        }),
      );
    }

    const storagePrefix = row.storagePrefix ?? `games/${row.gameModule.slug}/${row.version}`;
    const sourceDto = PRISMA_TO_DTO_SOURCE[row.gameModule.source];
    const existingManifest = asRecord(row.manifest);
    const maxScore = dto.maxScore ?? (existingManifest.max_score as number | undefined) ?? 100;
    const customResultScreen = Boolean(existingManifest.custom_result_screen);

    // Bangun & validasi Manifest (FR-07 & FR-36)
    const candidateManifest = {
      schema_version: 1 as const,
      name: row.gameModule.name,
      slug: row.gameModule.slug,
      version: row.version,
      source: sourceDto,
      template_id: row.gameModule.source === ModuleSource.TEMPLATE ? row.gameModule.templateId : null,
      entry: {
        html: 'index.html',
        css: 'style.css',
        js: 'script.js',
      },
      max_score: maxScore,
      custom_result_screen: customResultScreen,
    };

    const manifestParsed = ManifestSchema.safeParse(candidateManifest);
    if (!manifestParsed.success) {
      throw new RpcException(
        createServiceError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'Manifest modul tidak valid untuk dipublikasikan.',
        }),
      );
    }

    // FR-08 & Copy-on-Create v1.1.0:
    // Jika versi template belum punya berkas sama sekali (draft lama), materialize penuh dari templateId.
    // Jika sudah punya berkas (hasil Copy-on-Create / editan Monaco), pertahankan berkasnya dan suntikkan snapshot config ke script.js.
    if (row.gameModule.source === ModuleSource.TEMPLATE) {
      const templateId = row.gameModule.templateId;
      if (!templateId) {
        throw new RpcException(
          createServiceError({
            code: 'VALIDATION_ERROR',
            httpStatus: 400,
            message: 'Modul template wajib memiliki templateId.',
          }),
        );
      }

      if (row.files.length === 0) {
        const materializedFiles = await materializeTemplateFiles(templateId, asRecord(row.config));
        await this.seedVersionStarterFiles(row.id, storagePrefix, materializedFiles, author.userId);
      } else {
        const scriptFile = row.files.find((f) => f.relativePath === 'script.js');
        if (scriptFile) {
          const rawJs = (await this.r2Storage.getObjectText(scriptFile.asset.storagePath)) ?? '';
          const cleanedJs = rawJs.replace(/^window\.__KABIRU_INITIAL_CONFIG__\s*=\s*.*?;\n?/, '');
          const serializedConfig = JSON.stringify(asRecord(row.config))
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e');
          const snapshotJs = `window.__KABIRU_INITIAL_CONFIG__ = ${serializedConfig};\n${cleanedJs}`;

          const updatedScriptAsset = await this.assetService.uploadAndUpsertAsset({
            storagePath: `${storagePrefix}/script.js`,
            buffer: Buffer.from(snapshotJs, 'utf8'),
            mimeType: 'application/javascript; charset=utf-8',
            uploadedBy: author.userId,
          });

          await this.prisma.gameModuleFile.update({
            where: { id: scriptFile.id },
            data: { assetId: updatedScriptAsset.id },
          });
        }
      }
    }

    // Ambil ulang daftar file versi untuk verifikasi entrypoint & batas ukuran total (FR-05 & FR-07)
    const versionFiles = await this.prisma.gameModuleFile.findMany({
      where: { gameModuleVersionId: row.id },
      include: { asset: true },
      orderBy: { relativePath: 'asc' },
    });

    const hasEntrypoint = versionFiles.some(
      (f) => f.isEntrypoint || f.relativePath === 'index.html',
    );
    if (!hasEntrypoint) {
      throw new RpcException(
        createServiceError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: "Versi modul wajib memiliki file entrypoint 'index.html' sebelum dipublikasikan.",
        }),
      );
    }

    const totalSizeBytes = versionFiles.reduce((acc, f) => acc + Number(f.asset.sizeBytes), 0);
    if (totalSizeBytes > MAX_MODULE_VERSION_BYTES) {
      throw new RpcException(
        createServiceError({
          code: 'PAYLOAD_TOO_LARGE',
          httpStatus: 413,
          message: `Total ukuran file versi (${totalSizeBytes} bytes) melebihi batas maksimal (${MAX_MODULE_VERSION_BYTES} bytes).`,
        }),
      );
    }

    const bundleHasher = createHash('sha256');
    for (const vf of versionFiles) {
      bundleHasher.update(`${vf.relativePath}:${vf.asset.sha256}\n`);
    }
    const checksumSha256 = bundleHasher.digest('hex');

    const [publishedVersion] = await this.prisma.$transaction([
      this.prisma.gameModuleVersion.update({
        where: { id: row.id },
        data: {
          status: VersionStatus.PUBLISHED,
          storagePrefix,
          manifest: manifestParsed.data as unknown as Prisma.InputJsonValue,
          checksumSha256,
          publishedAt: new Date(),
          publishedBy: author.userId,
        },
        include: {
          gameModule: { include: { template: true } },
          files: { include: { asset: true }, orderBy: { relativePath: 'asc' } },
        },
      }),
      this.prisma.gameModule.update({
        where: { id: row.gameModuleId },
        data: { status: ModuleStatus.ACTIVE },
      }),
    ]);

    return this.mapVersionDetail(publishedVersion, true);
  }

  // ==========================================
  // 4. PLAYER EXECUTION (LMS IFRAME RUNTIME)
  // ==========================================

  async getPlayerPayload(
    params: GetGamePlayerPayloadDto,
    actor: ActorContext | null,
  ): Promise<GamePlayerPayloadDto> {
    const row = await this.prisma.gameModuleVersion.findUnique({
      where: { id: params.versionId },
      include: {
        gameModule: { include: { template: true } },
        files: { include: { asset: true }, orderBy: { relativePath: 'asc' } },
      },
    });

    if (!row || row.gameModule.deletedAt !== null) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Versi modul game tidak ditemukan.',
        }),
      );
    }

    // Siswa / publik hanya boleh memuat versi PUBLISHED.
    // Guru / Developer / Admin boleh memuat versi DRAFT untuk fitur Preview di Studio (US-03 & US-12).
    if (row.status !== VersionStatus.PUBLISHED) {
      const author = assertAuthorRole(actor);
      this.assertModuleAccess(row.gameModule, author);
    }

    const storagePrefix = row.storagePrefix ?? `games/${row.gameModule.slug}/${row.version}`;
    const baseStorageUrl = this.r2Storage.getBasePublicUrl(storagePrefix);
    const manifestObj = asRecord(row.manifest);
    const maxScore = typeof manifestObj.max_score === 'number' ? manifestObj.max_score : 100;

    // Jika versi DRAFT dari template belum memiliki file fisik (saat guru klik Preview sebelum Publish),
    // kita materialize secara on-the-fly di memory agar preview guru langsung tampil (US-12)!
    let filesPayload: GamePlayerPayloadDto['files'] = [];

    if (row.files.length === 0 && row.gameModule.source === ModuleSource.TEMPLATE && row.gameModule.templateId) {
      const previewFiles = await materializeTemplateFiles(
        row.gameModule.templateId,
        asRecord(row.config),
      );
      filesPayload = previewFiles.map((pf) => ({
        relativePath: pf.relativePath,
        isEntrypoint: pf.isEntrypoint,
        mimeType: pf.mimeType,
        publicUrl: `${baseStorageUrl}${pf.relativePath}`,
        content: pf.content,
      }));
    } else {
      filesPayload = await Promise.all(
        row.files.map(async (f) => {
          const content = isTextFile(f.asset.mimeType, f.relativePath)
            ? ((await this.r2Storage.getObjectText(f.asset.storagePath)) ?? undefined)
            : undefined;
          return {
            relativePath: f.relativePath,
            isEntrypoint: f.isEntrypoint,
            mimeType: f.asset.mimeType,
            publicUrl: this.r2Storage.getPublicUrl(f.asset.storagePath),
            content,
          };
        }),
      );
    }

    const entrypointFile =
      filesPayload.find((f) => f.isEntrypoint) ??
      filesPayload.find((f) => f.relativePath === 'index.html');

    return {
      versionId: row.id,
      gameModuleId: row.gameModuleId,
      moduleSlug: row.gameModule.slug,
      moduleName: row.gameModule.name,
      version: row.version,
      source: PRISMA_TO_DTO_SOURCE[row.gameModule.source],
      entrypoint: entrypointFile?.relativePath ?? 'index.html',
      baseStorageUrl,
      config: asRecord(row.config),
      maxScore,
      manifest: manifestObj,
      files: filesPayload,
    };
  }
}
