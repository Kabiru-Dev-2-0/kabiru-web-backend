import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RpcException } from '@nestjs/microservices';
import {
  BloomLevel,
  ContentStatus,
  DifficultyType,
  VisibilityType,
} from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { CurriculumService } from './curriculum.service';

describe('CurriculumService', () => {
  it('menerapkan filter jenjang SMA pada listSubjects', async () => {
    let capturedWhere: unknown;

    const prismaMock = {
      subject: {
        findMany: async (args: { where: unknown }) => {
          capturedWhere = args.where;
          return [
            {
              id: 'sub-1',
              educationLevelId: 'lvl-sma',
              name: 'Informatika',
              educationLevel: { code: 'SMA' },
              _count: { topics: 3 },
            },
          ];
        },
      },
    } as unknown as PrismaService;

    const service = new CurriculumService(prismaMock);
    const result = await service.listSubjects({ level: 'SMA' });

    assert.deepEqual(capturedWhere, { educationLevel: { code: 'SMA' } });
    assert.equal(result.length, 1);
    assert.equal(result[0]?.educationLevelCode, 'SMA');
    assert.equal(result[0]?.publishedTopicCount, 3);
  });

  it('memaksa status PUBLISHED & PUBLIC jika student meminta status draft di listTopics', async () => {
    let capturedWhere: Record<string, unknown> | undefined;

    const prismaMock = {
      topic: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return [];
        },
        count: async () => 0,
      },
    } as unknown as PrismaService;

    const service = new CurriculumService(prismaMock);
    await service.listTopics(
      { level: 'SMA', status: 'draft', page: 1, limit: 20 },
      { userId: 'student-1', role: 'student' },
    );

    assert.equal(capturedWhere?.status, ContentStatus.PUBLISHED);
    assert.equal(capturedWhere?.visibility, VisibilityType.PUBLIC);
  });

  it('mengizinkan teacher memfilter topik berstatus DRAFT', async () => {
    let capturedWhere: Record<string, unknown> | undefined;

    const prismaMock = {
      topic: {
        findMany: async (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return [];
        },
        count: async () => 0,
      },
    } as unknown as PrismaService;

    const service = new CurriculumService(prismaMock);
    await service.listTopics(
      { level: 'SMA', status: 'draft', page: 1, limit: 20 },
      { userId: 'teacher-1', role: 'teacher' },
    );

    assert.equal(capturedWhere?.status, ContentStatus.DRAFT);
    assert.equal(capturedWhere?.visibility, undefined);
  });

  it('melempar RpcException NOT_FOUND (404) saat student mengakses materi di dalam topik draft/tidak ada', async () => {
    const prismaMock = {
      topic: {
        findFirst: async () => null,
      },
    } as unknown as PrismaService;

    const service = new CurriculumService(prismaMock);

    await assert.rejects(
      () =>
        service.listMaterials(
          { topicId: '00000000-0000-0000-0000-000000000001', page: 1, limit: 50 },
          { userId: 'student-1', role: 'student' },
        ),
      (err: unknown) => {
        assert.ok(err instanceof RpcException);
        const errorPayload = err.getError() as { code: string; httpStatus: number };
        assert.equal(errorPayload.code, 'NOT_FOUND');
        assert.equal(errorPayload.httpStatus, 404);
        return true;
      },
    );
  });

  it('menyusun MaterialDetailDto lengkap (breadcrumb, navigasi lompat nomor, sanitasi payload soal) pada getMaterialDetail', async () => {
    const now = new Date('2026-10-31T00:00:00.000Z');

    const prismaMock = {
      material: {
        findFirst: async () => ({
          id: '11111111-1111-4111-8111-111111111301',
          topicId: '11111111-1111-4111-8111-111111111201',
          number: 1,
          title: 'Pengenalan Array',
          description: 'Dasar array',
          learningOutcome: 'Memahami indeks O(1)',
          content: '# Array\n\nKonten lengkap.',
          summary: 'Ringkasan array',
          status: ContentStatus.PUBLISHED,
          createdAt: now,
          updatedAt: now,
          coverAsset: null,
          topic: {
            id: '11111111-1111-4111-8111-111111111201',
            number: 1,
            title: 'Struktur Data Dasar',
            subject: {
              id: '11111111-1111-4111-8111-111111111102',
              name: 'Informatika',
              educationLevel: { code: 'SMA' },
            },
          },
          tests: [
            {
              id: '11111111-1111-4111-8111-111111111401',
              number: 1,
              title: 'Kuis Indeks Array',
              questionType: 'multiple_choice',
              prompt: 'Berapa kompleksitas akses elemen array berdasarkan indeks?',
              points: 10,
              difficulty: DifficultyType.EASY,
              bloomLevel: BloomLevel.UNDERSTAND,
              maxAttempts: 3,
              gameModuleVersionId: null,
              payload: {
                options: [
                  { id: 'opt-a', label: 'O(1)', isCorrect: true },
                  { id: 'opt-b', label: 'O(n)', isCorrect: false },
                ],
                correctOptionId: 'opt-a',
              },
              testCases: [
                {
                  id: '11111111-1111-4111-8111-111111111501',
                  input: 'arr = [10, 20, 30], idx = 1',
                  expectedOutput: '20',
                },
              ],
            },
          ],
        }),
        findMany: async () => [
          { id: '11111111-1111-4111-8111-111111111301' },
          { id: '11111111-1111-4111-8111-111111111304' },
        ],
      },
    } as unknown as PrismaService;

    const service = new CurriculumService(prismaMock);
    const detail = await service.getMaterialDetail(
      { materialId: '11111111-1111-4111-8111-111111111301' },
      { userId: 'student-1', role: 'student' },
    );

    assert.equal(detail.breadcrumb.educationLevelCode, 'SMA');
    assert.equal(detail.breadcrumb.subjectName, 'Informatika');
    assert.equal(detail.navigation.previousMaterialId, null);
    assert.equal(detail.navigation.nextMaterialId, '11111111-1111-4111-8111-111111111304');
    assert.equal(detail.tests.length, 1);

    const firstTest = detail.tests[0];
    assert.ok(firstTest);
    assert.equal('answerKey' in firstTest, false);
    assert.deepEqual(firstTest.payload, {
      options: [
        { id: 'opt-a', label: 'O(1)' },
        { id: 'opt-b', label: 'O(n)' },
      ],
    });
    assert.equal(firstTest.sampleTestCases.length, 1);
  });

  it('melempar RpcException NOT_FOUND (404) saat student mengakses detail materi draft/topik draft', async () => {
    let capturedWhere: Record<string, unknown> | undefined;

    const prismaMock = {
      material: {
        findFirst: async (args: { where: Record<string, unknown> }) => {
          capturedWhere = args.where;
          return null;
        },
      },
    } as unknown as PrismaService;

    const service = new CurriculumService(prismaMock);

    await assert.rejects(
      () =>
        service.getMaterialDetail(
          { materialId: '11111111-1111-4111-8111-111111111303' },
          { userId: 'student-1', role: 'student' },
        ),
      (err: unknown) => {
        assert.ok(err instanceof RpcException);
        const errorPayload = err.getError() as { code: string; httpStatus: number };
        assert.equal(errorPayload.code, 'NOT_FOUND');
        assert.equal(errorPayload.httpStatus, 404);
        return true;
      },
    );

    assert.equal(capturedWhere?.status, ContentStatus.PUBLISHED);
    assert.deepEqual(capturedWhere?.topic, {
      deletedAt: null,
      status: ContentStatus.PUBLISHED,
      visibility: VisibilityType.PUBLIC,
    });
  });

  // ==========================================
  // AUTHORING TESTS
  // ==========================================
  it('melempar RpcException FORBIDDEN (403) saat student memanggil createTopic', async () => {
    const prismaMock = {} as unknown as PrismaService;
    const service = new CurriculumService(prismaMock);

    await assert.rejects(
      () =>
        service.createTopic(
          {
            subjectId: '11111111-1111-4111-8111-111111111102',
            number: 3,
            title: 'Topik Ilegal',
            status: 'draft',
          },
          { userId: 'student-1', role: 'student' },
        ),
      (err: unknown) => {
        assert.ok(err instanceof RpcException);
        const errorPayload = err.getError() as { code: string; httpStatus: number };
        assert.equal(errorPayload.code, 'FORBIDDEN');
        assert.equal(errorPayload.httpStatus, 403);
        return true;
      },
    );
  });

  it('mengisi createdBy dengan actor.userId saat teacher membuat topik', async () => {
    let capturedData: any;

    const prismaMock = {
      subject: {
        findUnique: async () => ({ id: 'sub-1' }),
      },
      topic: {
        create: async (args: { data: any }) => {
          capturedData = args.data;
          return {
            id: 'top-new',
            subjectId: 'sub-1',
            number: 1,
            title: 'Topik Baru',
            description: null,
            coverAssetId: null,
            status: ContentStatus.DRAFT,
            subject: { name: 'Informatika' },
            coverAsset: null,
            _count: { materials: 0 },
          };
        },
      },
    } as unknown as PrismaService;

    const service = new CurriculumService(prismaMock);
    const result = await service.createTopic(
      {
        subjectId: '11111111-1111-4111-8111-111111111102',
        number: 1,
        title: 'Topik Baru',
        status: 'draft',
      },
      { userId: '00000000-0000-4000-8000-000000000099', role: 'teacher' },
    );

    assert.equal(capturedData.createdBy, '00000000-0000-4000-8000-000000000099');
    assert.equal(result.title, 'Topik Baru');
    assert.equal(result.status, 'draft');
  });

  it('menolak deleteSubject dengan CONFLICT (409) jika masih ada topik aktif', async () => {
    const prismaMock = {
      subject: {
        findUnique: async () => ({
          id: 'sub-1',
          _count: { topics: 2 },
        }),
      },
    } as unknown as PrismaService;

    const service = new CurriculumService(prismaMock);

    await assert.rejects(
      () =>
        service.deleteSubject(
          { subjectId: '11111111-1111-4111-8111-111111111102' },
          { userId: 'teacher-1', role: 'teacher' },
        ),
      (err: unknown) => {
        assert.ok(err instanceof RpcException);
        const errorPayload = err.getError() as { code: string; httpStatus: number };
        assert.equal(errorPayload.code, 'CONFLICT');
        assert.equal(errorPayload.httpStatus, 409);
        return true;
      },
    );
  });
});