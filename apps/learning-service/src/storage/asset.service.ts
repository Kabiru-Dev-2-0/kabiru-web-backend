import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { AssetKind, type Asset } from '@prisma/client';
import { createHash } from 'node:crypto';
import {
  MAX_MODULE_VERSION_BYTES,
  createServiceError,
  type ActorContext,
  type AssetDetailDto,
  type AssetIdParamDto,
  type AssetKindDto,
  type UploadAssetDto,
} from '@kabiru/contracts';
import { assertAuthorRole } from '../common/rpc-validation.util';
import { PrismaService } from '../prisma/prisma.service';
import { R2StorageService } from './r2-storage.service';

const PRISMA_TO_DTO_KIND: Record<AssetKind, AssetKindDto> = {
  [AssetKind.IMAGE]: 'image',
  [AssetKind.AUDIO]: 'audio',
  [AssetKind.SCRIPT]: 'script',
  [AssetKind.BUNDLE]: 'bundle',
  [AssetKind.DOCUMENT]: 'document',
};

const DTO_TO_PRISMA_KIND: Record<AssetKindDto, AssetKind> = {
  image: AssetKind.IMAGE,
  audio: AssetKind.AUDIO,
  script: AssetKind.SCRIPT,
  bundle: AssetKind.BUNDLE,
  document: AssetKind.DOCUMENT,
};

export function inferAssetKind(mimeType: string, filePath: string): AssetKind {
  const lowerMime = mimeType.toLowerCase();
  const lowerPath = filePath.toLowerCase();
  if (lowerMime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg|ico)$/.test(lowerPath)) {
    return AssetKind.IMAGE;
  }
  if (lowerMime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/.test(lowerPath)) {
    return AssetKind.AUDIO;
  }
  if (
    lowerMime.includes('javascript') ||
    lowerMime.includes('html') ||
    lowerMime.includes('css') ||
    lowerMime.includes('json') ||
    /\.(html|css|js|mjs|json)$/.test(lowerPath)
  ) {
    return AssetKind.SCRIPT;
  }
  return AssetKind.DOCUMENT;
}

@Injectable()
export class AssetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly r2Storage: R2StorageService,
  ) {}

  mapAssetToDetailDto(asset: Asset): AssetDetailDto {
    return {
      id: asset.id,
      kind: PRISMA_TO_DTO_KIND[asset.kind],
      storagePath: asset.storagePath,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
      sha256: asset.sha256,
      publicUrl: this.r2Storage.getPublicUrl(asset.storagePath),
      uploadedBy: asset.uploadedBy,
      createdAt: asset.createdAt.toISOString(),
    };
  }

  async uploadLmsAsset(dto: UploadAssetDto, actor: ActorContext | null): Promise<AssetDetailDto> {
    const author = assertAuthorRole(actor);
    const buffer =
      dto.encoding === 'base64'
        ? Buffer.from(dto.content, 'base64')
        : Buffer.from(dto.content, 'utf8');

    if (buffer.byteLength === 0) {
      throw new RpcException(
        createServiceError({
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
          message: 'File asset yang di-upload kosong.',
        }),
      );
    }

    if (buffer.byteLength > MAX_MODULE_VERSION_BYTES) {
      throw new RpcException(
        createServiceError({
          code: 'PAYLOAD_TOO_LARGE',
          httpStatus: 413,
          message: `Ukuran file melebihi batas maksimal (${MAX_MODULE_VERSION_BYTES} bytes).`,
        }),
      );
    }

    const sha256 = createHash('sha256').update(buffer).digest('hex');
    const storagePath = `lms/${dto.folder}/${sha256}-${dto.fileName}`;
    const kind = DTO_TO_PRISMA_KIND[dto.kind] ?? inferAssetKind(dto.mimeType, dto.fileName);

    const saved = await this.uploadAndUpsertAsset({
      storagePath,
      buffer,
      mimeType: dto.mimeType,
      kind,
      uploadedBy: author.userId,
    });

    return this.mapAssetToDetailDto(saved);
  }

  async uploadAndUpsertAsset(params: {
    storagePath: string;
    buffer: Buffer;
    mimeType: string;
    kind?: AssetKind;
    uploadedBy?: string | null;
  }): Promise<Asset> {
    const uploaded = await this.r2Storage.putObject({
      key: params.storagePath,
      body: params.buffer,
      contentType: params.mimeType,
    });

    const kind = params.kind ?? inferAssetKind(params.mimeType, params.storagePath);

    return this.prisma.asset.upsert({
      where: { storagePath: uploaded.storagePath },
      update: {
        kind,
        mimeType: params.mimeType,
        sizeBytes: BigInt(uploaded.sizeBytes),
        sha256: uploaded.sha256,
        uploadedBy: params.uploadedBy ?? undefined,
      },
      create: {
        kind,
        storagePath: uploaded.storagePath,
        mimeType: params.mimeType,
        sizeBytes: BigInt(uploaded.sizeBytes),
        sha256: uploaded.sha256,
        uploadedBy: params.uploadedBy ?? null,
      },
    });
  }

  async getAssetDetail(params: AssetIdParamDto): Promise<AssetDetailDto> {
    const asset = await this.prisma.asset.findUnique({
      where: { id: params.assetId },
    });

    if (!asset) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Asset tidak ditemukan.',
        }),
      );
    }

    return this.mapAssetToDetailDto(asset);
  }
}
