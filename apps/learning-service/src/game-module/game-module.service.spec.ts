import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RpcException } from '@nestjs/microservices';
import { ModuleSource, ModuleStatus, VersionStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import type { AssetService } from '../storage/asset.service';
import type { R2StorageService } from '../storage/r2-storage.service';
import { GameModuleService } from './game-module.service';

describe('GameModuleService (v1.1.0)', () => {
  it('FR-20b: mengizinkan guru (teacher) membuat modul jalur custom dan menginisialisasi berkas kerangka kosong di Monaco', async () => {
    const seededPaths: Array<{ path: string; content: string }> = [];

    const prismaMock = {
      gameModule: {
        findUnique: async () => null,
        create: async (args: { data: { name: string; slug: string; createdBy: string } }) => ({
          id: 'mod-custom-1',
          slug: args.data.slug,
          name: args.data.name,
          description: null,
          source: ModuleSource.CUSTOM,
          templateId: null,
          status: ModuleStatus.DRAFT,
          createdBy: args.data.createdBy,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          template: null,
          versions: [
            {
              id: 'ver-custom-1',
              version: '1.0.0',
              status: VersionStatus.DRAFT,
              storagePrefix: `games/${args.data.slug}/1.0.0`,
              publishedAt: null,
              publishedBy: null,
              createdAt: new Date(),
            },
          ],
        }),
      },
      gameModuleFile: {
        upsert: async () => ({}),
      },
    } as unknown as PrismaService;

    const assetServiceMock = {
      uploadAndUpsertAsset: async (params: { storagePath: string; buffer: Buffer }) => {
        seededPaths.push({
          path: params.storagePath,
          content: params.buffer.toString('utf8'),
        });
        return {
          id: `asset-${seededPaths.length}`,
          storagePath: params.storagePath,
          sizeBytes: BigInt(params.buffer.byteLength),
          sha256: 'b'.repeat(64),
        };
      },
    } as unknown as AssetService;

    const service = new GameModuleService(
      prismaMock,
      assetServiceMock,
      {} as unknown as R2StorageService,
    );

    const created = await service.createModule(
      {
        name: 'Game Custom Guru Informatika',
        source: 'custom',
      },
      { userId: 'teacher-1', role: 'teacher' },
    );

    assert.equal(created.source, 'custom');
    assert.equal(created.createdBy, 'teacher-1');
    assert.equal(seededPaths.length, 3);
    assert.ok(seededPaths.some((f) => f.path.endsWith('/index.html')));
    assert.ok(seededPaths.some((f) => f.path.endsWith('/script.js') && f.content.includes('window.Kabiru.onInit')));
  });

  it('FR-21: menyalin starter code template (Copy-on-Create) saat modul jalur template dibuat', async () => {
    const seededFiles: Array<{ path: string; content: string }> = [];

    const prismaMock = {
      gameTemplate: {
        findUnique: async () => ({
          id: 'multiple_choice',
          name: 'Multiple Choice',
          isActive: true,
          defaultConfig: { theme: { primaryColor: '#0284C7' } },
          starterFiles: {
            html: '<!DOCTYPE html><html><body>Template MC</body></html>',
            css: ':root { --kabiru-primary: #0284c7; }',
            js: 'window.Kabiru.onInit(function(){});',
          },
        }),
      },
      gameModule: {
        findUnique: async () => null,
        create: async (args: { data: { name: string; slug: string; createdBy: string } }) => ({
          id: 'mod-tpl-copy',
          slug: args.data.slug,
          name: args.data.name,
          description: null,
          source: ModuleSource.TEMPLATE,
          templateId: 'multiple_choice',
          status: ModuleStatus.DRAFT,
          createdBy: args.data.createdBy,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          template: { name: 'Multiple Choice' },
          versions: [
            {
              id: 'ver-tpl-copy-1',
              version: '1.0.0',
              status: VersionStatus.DRAFT,
              storagePrefix: `games/${args.data.slug}/1.0.0`,
              publishedAt: null,
              publishedBy: null,
              createdAt: new Date(),
            },
          ],
        }),
      },
      gameModuleFile: {
        upsert: async () => ({}),
      },
    } as unknown as PrismaService;

    const assetServiceMock = {
      uploadAndUpsertAsset: async (params: { storagePath: string; buffer: Buffer }) => {
        seededFiles.push({
          path: params.storagePath,
          content: params.buffer.toString('utf8'),
        });
        return {
          id: `asset-${seededFiles.length}`,
          storagePath: params.storagePath,
          sizeBytes: BigInt(params.buffer.byteLength),
          sha256: 'c'.repeat(64),
        };
      },
    } as unknown as AssetService;

    const service = new GameModuleService(
      prismaMock,
      assetServiceMock,
      {} as unknown as R2StorageService,
    );

    await service.createModule(
      {
        name: 'Kuis Array Guru',
        source: 'template',
        templateId: 'multiple_choice',
      },
      { userId: 'teacher-1', role: 'teacher' },
    );

    assert.equal(seededFiles.length, 3);
    assert.ok(seededFiles.find((f) => f.path.endsWith('/index.html'))?.content.includes('Template MC'));
    assert.ok(seededFiles.find((f) => f.path.endsWith('/style.css'))?.content.includes('--kabiru-primary'));
  });

  it('FR-20c / FR-17: menolak guru A mengakses modul buatan guru B dengan 403 FORBIDDEN', async () => {
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

  it('FR-27: menolak injeksi CSS berbahaya pada config.theme di updateVersionConfig (400 VALIDATION_ERROR)', async () => {
    const prismaMock = {
      gameModuleVersion: {
        findUnique: async () => ({
          id: 'ver-draft-1',
          gameModuleId: 'mod-1',
          version: '1.0.0',
          status: VersionStatus.DRAFT,
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
            config: {
              theme: {
                primaryColor: '#fff; background: url(https://evil.example/steal)',
              },
            },
          },
          { userId: 'teacher-1', role: 'teacher' },
        );
      },
      (err: unknown) => {
        assert.ok(err instanceof RpcException);
        const errorPayload = err.getError() as { code: string; httpStatus: number };
        assert.equal(errorPayload.code, 'VALIDATION_ERROR');
        assert.equal(errorPayload.httpStatus, 400);
        return true;
      },
    );
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

  it('FR-08: mematerialisasi 3 file saat publish modul template legacy tanpa file awal & mempertahankan custom_result_screen', async () => {
    const uploadedPaths: string[] = [];
    const upsertedFiles: Array<{ relativePath: string; isEntrypoint: boolean }> = [];

    const versionRow = {
      id: '11111111-1111-4111-8111-111111111777',
      gameModuleId: 'mod-tpl-1',
      version: '1.0.0',
      status: VersionStatus.DRAFT,
      config: {
        theme: { primaryColor: '#0284C7' },
        content: {
          question: 'Apa kepanjangan CPU?',
          options: ['Central Processing Unit', 'Central Program Utility'],
          answerIndex: 0,
        },
      },
      manifest: { max_score: 100, custom_result_screen: true },
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

    let savedManifest: Record<string, unknown> | null = null;

    const prismaMock = {
      gameModuleVersion: {
        findUnique: async () => versionRow,
        update: async (args: { data: { manifest: Record<string, unknown> } }) => {
          savedManifest = args.data.manifest;
          return {
            ...versionRow,
            manifest: args.data.manifest,
            status: VersionStatus.PUBLISHED,
            publishedAt: new Date(),
            publishedBy: 'teacher-1',
            files: [],
          };
        },
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
    assert.equal(savedManifest?.custom_result_screen, true);
    assert.deepEqual(uploadedPaths, [
      'games/kuis-cpu/1.0.0/index.html',
      'games/kuis-cpu/1.0.0/style.css',
      'games/kuis-cpu/1.0.0/script.js',
    ]);
  });
});
