import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RpcException } from '@nestjs/microservices';
import { ContentStatus, VisibilityType } from '@prisma/client';
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
});