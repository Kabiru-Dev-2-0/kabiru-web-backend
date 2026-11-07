import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RpcException } from '@nestjs/microservices';
import { ModuleSource, ModuleStatus, VersionStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AssetService } from '../storage/asset.service';
import type { R2StorageService } from '../storage/r2-storage.service';
import { GameModuleService } from './game-module.service';

describe('GameModuleService', () => {
  it('FR-16: menolak guru (teacher) yang mencoba membuat modul jalur custom dengan 403 FORBIDDEN', async () => {
    const service = new GameModuleService(
      {} as unknown as PrismaService,
      {} as unknown as AssetService,
      {} as unknown as R2StorageService,
    );

    await assert.rejects(
      async () => {
        await service.createModule(
          {
            name: 'Game Custom Guru',
            source: 'custom',
          },
          { userId: 'teacher-1', role: 'teacher' },
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof RpcException);
        const errorPayload = err.getError() as { code: string; httpStatus: number };
        assert.equal(errorPayload.code, 'FORBIDDEN');
        assert.equal(errorPayload.httpStatus, 403);
        return true;
      },
    );
  });

  it('FR-17: menolak guru A mengakses modul buatan guru B dengan 403 FORBIDDEN', async () => {
    const prismaMock = {
      gameModule: {
        findFirst: async () => ({
          id: 'mod-guru-b',
          slug: 'kuis-guru-b',
          name: 'Kuis Guru B',
          description: null,
          source: ModuleSource.TEMPLATE,
          templateId: 'multiple_choice',
          status: ModuleStatus.DRAFT,
          createdBy: 'teacher-B',
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          template: { name: 'Multiple Choice' },
          versions: [],
        }),
      },
    } as unknown as PrismaService;

    const service = new GameModuleService(
      prismaMock,
      {} as unknown as AssetService,
      {} as unknown as R2StorageService,
    );

    await assert.rejects(
      async () => {
        await service.getModuleDetail(
          { moduleId: '11111111-1111-4111-8111-111111111999' },
          { userId: 'teacher-A', role: 'teacher' },
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof RpcException);
        const errorPayload = err.getError() as { code: string; httpStatus: number };
        assert.equal(errorPayload.code, 'FORBIDDEN');
        assert.equal(errorPayload.httpStatus, 403);
        return true;
      },
    );
  });

  it('FR-17: memfilter listModules berdasarkan createdBy saat dipanggil oleh teacher', async () => {
    let capturedWhere: Record<string, unknown> | undefined;

    const prismaMock = {
      gameModule: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return [];
        },
        count: async () => 0,
      },
    } as unknown as PrismaService;

    const service = new GameModuleService(
      prismaMock,
      {} as unknown as AssetService,
      {} as unknown as R2StorageService,
    );

    await service.listModules(
      { page: 1, limit: 20 },
      { userId: 'teacher-123', role: 'teacher' },
    );

    assert.equal(capturedWhere?.createdBy, 'teacher-123');
    assert.equal(capturedWhere?.deletedAt, null);
  });

  it('FR-06: menolak perubahan konfigurasi pada versi yang sudah PUBLISHED (409 CONFLICT)', async () => {
    const prismaMock = {
      gameModuleVersion: {
        findUnique: async () => ({
          id: 'ver-pub-1',
          gameModuleId: 'mod-1',
          version: '1.0.0',
          status: VersionStatus.PUBLISHED,
          config: {},
          gameModule: {
            id: 'mod-1',
            createdBy: 'teacher-1',
            deletedAt: null,
            source: ModuleSource.TEMPLATE,
            template: null,
          },
        }),
      },
    } as unknown as PrismaService;

    const service = new GameModuleService(
      prismaMock,
      {} as unknown as AssetService,
      {} as unknown as R2StorageService,
    );

    await assert.rejects(
      async () => {
        await service.updateVersionConfig(
          {
            versionId: '11111111-1111-4111-8111-111111111888',
            config: { question: 'Diubah setelah publish' },
          },
          { userId: 'teacher-1', role: 'teacher' },
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof RpcException);
        const errorPayload = err.getError() as { code: string; httpStatus: number };
        assert.equal(errorPayload.code, 'CONFLICT');
        assert.equal(errorPayload.httpStatus, 409);
        return true;
      },
    );
  });

  it('FR-08: mematerialisasi 3 file (index.html, style.css, script.js) saat publish modul template', async () => {
    const uploadedPaths: string[] = [];
    const upsertedFiles: Array<{ relativePath: string; isEntrypoint: boolean }> = [];

    const versionRow = {
      id: '11111111-1111-4111-8111-111111111777',
      gameModuleId: 'mod-tpl-1',
      version: '1.0.0',
      status: VersionStatus.DRAFT,
      config: {
        question: 'Apa kepanjangan CPU?',
        options: ['Central Processing Unit', 'Central Program Utility'],
        answerIndex: 0,
      },
      manifest: { max_score: 100 },
      checksumSha256: null,
      storagePrefix: 'games/kuis-cpu/1.0.0',
      publishedAt: null,
      publishedBy: null,
      createdAt: new Date(),
      gameModule: {
        id: 'mod-tpl-1',
        slug: 'kuis-cpu',
        name: 'Kuis CPU',
        description: null,
        source: ModuleSource.TEMPLATE,
        templateId: 'multiple_choice',
        status: ModuleStatus.DRAFT,
        createdBy: 'teacher-1',
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        template: null,
      },
      files: [],
    };

    const prismaMock = {
      gameModuleVersion: {
        findUnique: async () => versionRow,
        update: async () => ({
          ...versionRow,
          status: VersionStatus.PUBLISHED,
          publishedAt: new Date(),
          publishedBy: 'teacher-1',
          files: [],
        }),
      },
      gameModuleFile: {
        upsert: async (args: { create: { relativePath: string; isEntrypoint: boolean } }) => {
          upsertedFiles.push({
            relativePath: args.create.relativePath,
            isEntrypoint: args.create.isEntrypoint,
          });
          return {};
        },
        findMany: async () =>
          upsertedFiles.map((f, idx) => ({
            id: `file-${idx}`,
            gameModuleVersionId: versionRow.id,
            assetId: `asset-${idx}`,
            relativePath: f.relativePath,
            isEntrypoint: f.isEntrypoint,
            createdAt: new Date(),
            asset: {
              id: `asset-${idx}`,
              sizeBytes: BigInt(256),
              sha256: 'a'.repeat(64),
              mimeType: 'text/plain',
              storagePath: `games/kuis-cpu/1.0.0/${f.relativePath}`,
            },
          })),
      },
      gameModule: {
        update: async () => ({}),
      },
      $transaction: async (ops: Array<Promise<unknown>>) => Promise.all(ops),
    } as unknown as PrismaService;

    const assetServiceMock = {
      uploadAndUpsertAsset: async (params: { storagePath: string }) => {
        uploadedPaths.push(params.storagePath);
        return {
          id: `asset-${uploadedPaths.length}`,
          storagePath: params.storagePath,
          sizeBytes: BigInt(256),
          sha256: 'a'.repeat(64),
        };
      },
    } as unknown as AssetService;

    const r2Mock = {
      getPublicUrl: (key: string) => `http://localhost:3000/assets/${key}`,
      getObjectText: async () => '',
    } as unknown as R2StorageService;

    const service = new GameModuleService(prismaMock, assetServiceMock, r2Mock);
    const result = await service.publishVersion(
      { versionId: versionRow.id },
      { userId: 'teacher-1', role: 'teacher' },
    );

    assert.equal(result.status, 'published');
    assert.deepEqual(uploadedPaths, [
      'games/kuis-cpu/1.0.0/index.html',
      'games/kuis-cpu/1.0.0/style.css',
      'games/kuis-cpu/1.0.0/script.js',
    ]);
    assert.equal(
      upsertedFiles.find((f) => f.relativePath === 'index.html')?.isEntrypoint,
      true,
    );
  });
});
