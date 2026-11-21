import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import {
  BloomLevel,
  ContentStatus,
  DifficultyType,
  HintType,
  VersionStatus,
  VisibilityType,
  type Prisma,
} from '@prisma/client';
import {
  EDUCATION_LEVEL_CODES,
  createServiceError,
  type ActorContext,
  type BadgeCatalogItemDto,
  type BloomLevelDto,
  type ChallengeCatalogItemDto,
  type CreateMaterialDto,
  type CreateSubjectDto,
  type CreateTestDto,
  type CreateTopicDto,
  type DifficultyTypeDto,
  type EducationLevelItemDto,
  type GetMaterialDetailParamsDto,
  type GetTestHintParamsDto,
  type HintTypeDto,
  type ListChallengesQueryDto,
  type ListMaterialsQueryDto,
  type ListSubjectsQueryDto,
  type ListTopicsQueryDto,
  type MaterialAuthoringDetailDto,
  type MaterialDetailDto,
  type MaterialIdParamDto,
  type MaterialListItemDto,
  type MutationResultDto,
  type PaginationMeta,
  type PracticeCaseStudyItemDto,
  type QuestionTypeDto,
  type QuizGameModuleSummaryDto,
  type QuizItemDto,
  type SubjectIdParamDto,
  type SubjectItemDto,
  type TestForEvaluationInternalDto,
  type TestHintContextInternalDto,
  type TestHintDetailDto,
  type TestIdParamDto,
  type TopicIdParamDto,
  type TopicItemDto,
  type UpdateMaterialPayloadDto,
  type UpdateSubjectPayloadDto,
  type UpdateTestPayloadDto,
  type UpdateTopicPayloadDto,
} from '@kabiru/contracts';
import {
  assertAuthorRole,
  canAccessUnpublishedContent,
} from '../common/rpc-validation.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  toAssetSummaryDto,
  toContentStatusDto,
  toContentStatusPrisma,
  toEducationLevelItemDto,
  toMaterialDetailDto,
  toMaterialListItemDto,
  toSubjectItemDto,
  toTopicItemDto,
} from './curriculum.mapper';

export interface PaginatedResult<TItem> {
  items: TItem[];
  pagination: PaginationMeta;
}

@Injectable()
export class CurriculumService {
  constructor(private readonly prisma: PrismaService) {}

  async listEducationLevels(): Promise<EducationLevelItemDto[]> {
    const rows = await this.prisma.educationLevel.findMany();
    const orderMap = new Map<string, number>(
      EDUCATION_LEVEL_CODES.map((code, idx) => [code, idx]),
    );

    return rows
      .sort((a, b) => (orderMap.get(a.code) ?? 99) - (orderMap.get(b.code) ?? 99))
      .map(toEducationLevelItemDto);
  }

  async listSubjects(query: ListSubjectsQueryDto): Promise<SubjectItemDto[]> {
    const where: Prisma.SubjectWhereInput = {
      educationLevel: { code: query.level },
      ...(query.search
        ? { name: { contains: query.search, mode: 'insensitive' } }
        : {}),
    };

    const rows = await this.prisma.subject.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        educationLevel: { select: { code: true } },
        _count: {
          select: {
            topics: {
              where: {
                status: ContentStatus.PUBLISHED,
                visibility: VisibilityType.PUBLIC,
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    return rows.map(toSubjectItemDto);
  }

  async listTopics(
    query: ListTopicsQueryDto,
    actor: ActorContext | null,
  ): Promise<PaginatedResult<TopicItemDto>> {
    const isAuthor = canAccessUnpublishedContent(actor);

    const statusFilter: ContentStatus | undefined = isAuthor
      ? query.status
        ? toContentStatusPrisma(query.status)
        : undefined
      : ContentStatus.PUBLISHED;

    const where: Prisma.TopicWhereInput = {
      deletedAt: null,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(!isAuthor ? { visibility: VisibilityType.PUBLIC } : {}),
      ...(query.subjectId ? { subjectId: query.subjectId } : {}),
      subject: {
        educationLevel: { code: query.level },
      },
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [rows, totalItems] = await Promise.all([
      this.prisma.topic.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
        include: {
          subject: { select: { name: true } },
          coverAsset: true,
          _count: {
            select: {
              materials: {
                where: {
                  status: ContentStatus.PUBLISHED,
                  deletedAt: null,
                },
              },
            },
          },
        },
      }),
      this.prisma.topic.count({ where }),
    ]);

    return {
      items: rows.map(toTopicItemDto),
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.limit),
      },
    };
  }

  async listMaterials(
    query: ListMaterialsQueryDto,
    actor: ActorContext | null,
  ): Promise<PaginatedResult<MaterialListItemDto>> {
    const isAuthor = canAccessUnpublishedContent(actor);

    const parentTopic = await this.prisma.topic.findFirst({
      where: {
        id: query.topicId,
        deletedAt: null,
        ...(!isAuthor
          ? {
              status: ContentStatus.PUBLISHED,
              visibility: VisibilityType.PUBLIC,
            }
          : {}),
      },
      select: { id: true },
    });

    if (!parentTopic) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Topik tidak ditemukan atau belum dipublikasikan',
        }),
      );
    }

    const statusFilter: ContentStatus | undefined = isAuthor
      ? query.status
        ? toContentStatusPrisma(query.status)
        : undefined
      : ContentStatus.PUBLISHED;

    const where: Prisma.MaterialWhereInput = {
      topicId: query.topicId,
      deletedAt: null,
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    const skip = (query.page - 1) * query.limit;

    const [rows, totalItems] = await Promise.all([
      this.prisma.material.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          topicId: true,
          number: true,
          title: true,
          description: true,
          learningOutcome: true,
          summary: true,
          status: true,
          updatedAt: true,
          coverAsset: true,
          _count: {
            select: {
              tests: {
                where: {
                  status: ContentStatus.PUBLISHED,
                  deletedAt: null,
                },
              },
            },
          },
        },
      }),
      this.prisma.material.count({ where }),
    ]);

    return {
      items: rows.map(toMaterialListItemDto),
      pagination: {
        page: query.page,
        limit: query.limit,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / query.limit),
      },
    };
  }

  async getMaterialDetail(
    params: GetMaterialDetailParamsDto,
    actor: ActorContext | null,
  ): Promise<MaterialDetailDto> {
    const isAuthor = canAccessUnpublishedContent(actor);

    const material = await this.prisma.material.findFirst({
      where: {
        id: params.materialId,
        deletedAt: null,
        ...(!isAuthor ? { status: ContentStatus.PUBLISHED } : {}),
        topic: {
          deletedAt: null,
          ...(!isAuthor
            ? {
                status: ContentStatus.PUBLISHED,
                visibility: VisibilityType.PUBLIC,
              }
            : {}),
        },
      },
      select: {
        id: true,
        topicId: true,
        number: true,
        title: true,
        description: true,
        learningOutcome: true,
        content: true,
        summary: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        coverAsset: true,
        topic: {
          select: {
            id: true,
            number: true,
            title: true,
            subject: {
              select: {
                id: true,
                name: true,
                educationLevel: {
                  select: { code: true },
                },
              },
            },
          },
        },
        tests: {
          where: {
            deletedAt: null,
            ...(!isAuthor ? { status: ContentStatus.PUBLISHED } : {}),
          },
          orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            number: true,
            title: true,
            questionType: true,
            prompt: true,
            points: true,
            difficulty: true,
            bloomLevel: true,
            maxAttempts: true,
            gameModuleVersionId: true,
            payload: true,
            testCases: {
              where: { isHidden: false },
              orderBy: { id: 'asc' },
              select: {
                id: true,
                input: true,
                expectedOutput: true,
              },
            },
          },
        },
      },
    });

    if (!material) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Materi tidak ditemukan atau belum dipublikasikan',
        }),
      );
    }

    const siblings = await this.prisma.material.findMany({
      where: {
        topicId: material.topicId,
        deletedAt: null,
        ...(!isAuthor ? { status: ContentStatus.PUBLISHED } : {}),
      },
      orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });

    const currentIndex = siblings.findIndex((item) => item.id === material.id);
    const navigation = {
      previousMaterialId: currentIndex > 0 ? (siblings[currentIndex - 1]?.id ?? null) : null,
      nextMaterialId:
        currentIndex >= 0 && currentIndex < siblings.length - 1
          ? (siblings[currentIndex + 1]?.id ?? null)
          : null,
    };

    return toMaterialDetailDto(material, navigation);
  }

  // ==========================================
  // AUTHORING: SUBJECT CRUD
  // ==========================================
  async createSubject(
    dto: CreateSubjectDto,
    actor: ActorContext | null,
  ): Promise<SubjectItemDto> {
    assertAuthorRole(actor);

    const level = await this.prisma.educationLevel.findUnique({
      where: { code: dto.educationLevelCode },
    });

    if (!level) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: `Jenjang pendidikan ${dto.educationLevelCode} tidak ditemukan`,
        }),
      );
    }

    const row = await this.prisma.subject.create({
      data: {
        educationLevelId: level.id,
        name: dto.name,
      },
      include: {
        educationLevel: { select: { code: true } },
        _count: { select: { topics: true } },
      },
    });

    return toSubjectItemDto(row);
  }

  async updateSubject(
    dto: UpdateSubjectPayloadDto,
    actor: ActorContext | null,
  ): Promise<SubjectItemDto> {
    assertAuthorRole(actor);

    const existing = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
    });

    if (!existing) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Mata pelajaran tidak ditemukan',
        }),
      );
    }

    const row = await this.prisma.subject.update({
      where: { id: dto.subjectId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
      },
      include: {
        educationLevel: { select: { code: true } },
        _count: { select: { topics: true } },
      },
    });

    return toSubjectItemDto(row);
  }

  async deleteSubject(
    dto: SubjectIdParamDto,
    actor: ActorContext | null,
  ): Promise<MutationResultDto> {
    assertAuthorRole(actor);

    const existing = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
      include: {
        _count: {
          select: {
            topics: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!existing) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Mata pelajaran tidak ditemukan',
        }),
      );
    }

    if (existing._count.topics > 0) {
      throw new RpcException(
        createServiceError({
          code: 'CONFLICT',
          httpStatus: 409,
          message: 'Mata pelajaran masih memiliki topik aktif. Hapus atau pindahkan topik terlebih dahulu.',
        }),
      );
    }

    await this.prisma.subject.delete({ where: { id: dto.subjectId } });
    return { success: true, id: dto.subjectId, message: 'Mata pelajaran berhasil dihapus' };
  }

  // ==========================================
  // AUTHORING: TOPIC CRUD
  // ==========================================
  async createTopic(
    dto: CreateTopicDto,
    actor: ActorContext | null,
  ): Promise<TopicItemDto> {
    const authActor = assertAuthorRole(actor);

    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
    });

    if (!subject) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Mata pelajaran untuk topik ini tidak ditemukan',
        }),
      );
    }

    const row = await this.prisma.topic.create({
      data: {
        subjectId: dto.subjectId,
        number: dto.number,
        title: dto.title,
        description: dto.description ?? null,
        coverAssetId: dto.coverAssetId ?? null,
        status: toContentStatusPrisma(dto.status),
        createdBy: authActor.userId,
      },
      include: {
        subject: { select: { name: true } },
        coverAsset: true,
        _count: { select: { materials: true } },
      },
    });

    return toTopicItemDto(row);
  }

  async updateTopic(
    dto: UpdateTopicPayloadDto,
    actor: ActorContext | null,
  ): Promise<TopicItemDto> {
    assertAuthorRole(actor);

    const existing = await this.prisma.topic.findFirst({
      where: { id: dto.topicId, deletedAt: null },
    });

    if (!existing) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Topik tidak ditemukan atau sudah dihapus',
        }),
      );
    }

    const row = await this.prisma.topic.update({
      where: { id: dto.topicId },
      data: {
        ...(dto.number !== undefined ? { number: dto.number } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.coverAssetId !== undefined ? { coverAssetId: dto.coverAssetId } : {}),
        ...(dto.status !== undefined ? { status: toContentStatusPrisma(dto.status) } : {}),
      },
      include: {
        subject: { select: { name: true } },
        coverAsset: true,
        _count: { select: { materials: true } },
      },
    });

    return toTopicItemDto(row);
  }

  async deleteTopic(
    dto: TopicIdParamDto,
    actor: ActorContext | null,
  ): Promise<MutationResultDto> {
    assertAuthorRole(actor);

    const existing = await this.prisma.topic.findFirst({
      where: { id: dto.topicId, deletedAt: null },
    });

    if (!existing) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Topik tidak ditemukan atau sudah dihapus',
        }),
      );
    }

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.topic.update({
        where: { id: dto.topicId },
        data: { deletedAt: now },
      }),
      this.prisma.material.updateMany({
        where: { topicId: dto.topicId, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);

    return { success: true, id: dto.topicId, message: 'Topik dan materi terkait berhasil dihapus (soft-delete)' };
  }

  // ==========================================
  // AUTHORING: MATERIAL CRUD & AUTHORING DETAIL
  // ==========================================
  async createMaterial(
    dto: CreateMaterialDto,
    actor: ActorContext | null,
  ): Promise<MaterialListItemDto> {
    const authActor = assertAuthorRole(actor);

    const topic = await this.prisma.topic.findFirst({
      where: { id: dto.topicId, deletedAt: null },
    });

    if (!topic) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Topik untuk materi ini tidak ditemukan atau sudah dihapus',
        }),
      );
    }

    const row = await this.prisma.material.create({
      data: {
        topicId: dto.topicId,
        number: dto.number,
        title: dto.title,
        description: dto.description ?? null,
        learningOutcome: dto.learningOutcome ?? null,
        content: dto.content,
        summary: dto.summary ?? null,
        coverAssetId: dto.coverAssetId ?? null,
        status: toContentStatusPrisma(dto.status),
        createdBy: authActor.userId,
      },
      include: {
        coverAsset: true,
        _count: { select: { tests: true } },
      },
    });

    return toMaterialListItemDto(row);
  }

  async updateMaterial(
    dto: UpdateMaterialPayloadDto,
    actor: ActorContext | null,
  ): Promise<MaterialListItemDto> {
    assertAuthorRole(actor);

    const existing = await this.prisma.material.findFirst({
      where: { id: dto.materialId, deletedAt: null },
    });

    if (!existing) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Materi tidak ditemukan atau sudah dihapus',
        }),
      );
    }

    const row = await this.prisma.material.update({
      where: { id: dto.materialId },
      data: {
        ...(dto.number !== undefined ? { number: dto.number } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.learningOutcome !== undefined ? { learningOutcome: dto.learningOutcome } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.summary !== undefined ? { summary: dto.summary } : {}),
        ...(dto.coverAssetId !== undefined ? { coverAssetId: dto.coverAssetId } : {}),
        ...(dto.status !== undefined ? { status: toContentStatusPrisma(dto.status) } : {}),
      },
      include: {
        coverAsset: true,
        _count: { select: { tests: true } },
      },
    });

    return toMaterialListItemDto(row);
  }

  async deleteMaterial(
    dto: MaterialIdParamDto,
    actor: ActorContext | null,
  ): Promise<MutationResultDto> {
    assertAuthorRole(actor);

    const existing = await this.prisma.material.findFirst({
      where: { id: dto.materialId, deletedAt: null },
    });

    if (!existing) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Materi tidak ditemukan atau sudah dihapus',
        }),
      );
    }

    await this.prisma.material.update({
      where: { id: dto.materialId },
      data: { deletedAt: new Date() },
    });

    return { success: true, id: dto.materialId, message: 'Materi berhasil dihapus (soft-delete)' };
  }

  async getMaterialAuthoringDetail(
    dto: MaterialIdParamDto,
    actor: ActorContext | null,
  ): Promise<MaterialAuthoringDetailDto> {
    assertAuthorRole(actor);

    const material = await this.prisma.material.findFirst({
      where: { id: dto.materialId, deletedAt: null },
      include: {
        coverAsset: true,
        tests: {
          where: { deletedAt: null },
          orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
          include: {
            testCases: {
              orderBy: { id: 'asc' },
            },
          },
        },
      },
    });

    if (!material) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Materi tidak ditemukan atau sudah dihapus',
        }),
      );
    }

    return {
      id: material.id,
      topicId: material.topicId,
      number: material.number,
      title: material.title,
      description: material.description,
      learningOutcome: material.learningOutcome,
      content: material.content,
      summary: material.summary,
      status: toContentStatusDto(material.status),
      createdBy: material.createdBy,
      coverAsset: toAssetSummaryDto(material.coverAsset),
      createdAt: material.createdAt.toISOString(),
      updatedAt: material.updatedAt.toISOString(),
      tests: material.tests.map((t) => ({
        id: t.id,
        number: t.number,
        title: t.title,
        questionType: t.questionType as any,
        prompt: t.prompt,
        points: t.points,
        difficulty: t.difficulty.toLowerCase() as any,
        bloomLevel: t.bloomLevel.toLowerCase() as any,
        maxAttempts: t.maxAttempts,
        gameModuleVersionId: t.gameModuleVersionId,
        payload: t.payload as Record<string, unknown> | null,
        answerKey: t.answerKey as Record<string, unknown> | null,
        status: toContentStatusDto(t.status),
        testCases: t.testCases.map((tc) => ({
          id: tc.id,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          weight: tc.weight,
          isHidden: tc.isHidden,
        })),
      })),
    };
  }

  // ==========================================
  // 6. SMA - PRACTICE STUDI KASUS & HINT BERTINGKAT
  // ==========================================

  async listPracticesByMaterial(
    params: MaterialIdParamDto,
    actor: ActorContext | null,
  ): Promise<PracticeCaseStudyItemDto[]> {
    const isAuthor = canAccessUnpublishedContent(actor);

    const rows = await this.prisma.test.findMany({
      where: {
        materialId: params.materialId,
        deletedAt: null,
        ...(!isAuthor ? { status: ContentStatus.PUBLISHED } : {}),
        OR: [
          { questionType: { in: ['case_study', 'code_debugger'] } },
          { testCases: { some: {} } },
          { hints: { some: {} } },
        ],
      },
      orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
      include: {
        testCases: {
          where: { isHidden: false },
          orderBy: { id: 'asc' },
        },
        hints: {
          orderBy: { level: 'asc' },
          select: { id: true, level: true, type: true },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      materialId: row.materialId,
      number: row.number,
      title: row.title,
      questionType: row.questionType as QuestionTypeDto,
      prompt: row.prompt,
      points: row.points,
      difficulty: row.difficulty.toLowerCase() as DifficultyTypeDto,
      bloomLevel: row.bloomLevel.toLowerCase() as BloomLevelDto,
      maxAttempts: row.maxAttempts,
      payload: (row.payload as Record<string, unknown> | null) ?? null,
      sampleTestCases: row.testCases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      })),
      availableHints: row.hints.map((h) => ({
        id: h.id,
        level: h.level,
        type: h.type.toLowerCase() as HintTypeDto,
      })),
    }));
  }

  async getTestHintByLevel(
    params: GetTestHintParamsDto,
    actor: ActorContext | null,
  ): Promise<TestHintDetailDto> {
    const isAuthor = canAccessUnpublishedContent(actor);

    const hint = await this.prisma.hint.findFirst({
      where: {
        testId: params.testId,
        level: params.level,
        test: {
          deletedAt: null,
          ...(!isAuthor ? { status: ContentStatus.PUBLISHED } : {}),
        },
      },
    });

    if (!hint) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: `Hint level ${params.level} untuk soal ini tidak ditemukan`,
        }),
      );
    }

    return {
      id: hint.id,
      testId: hint.testId,
      level: hint.level,
      type: hint.type.toLowerCase() as HintTypeDto,
      content: hint.content,
    };
  }

  // ==========================================
  // 7. SMA - QUIZ (BERELASI DENGAN GAME MODULE)
  // ==========================================

  async listQuizzesByMaterial(
    params: MaterialIdParamDto,
    actor: ActorContext | null,
  ): Promise<QuizItemDto[]> {
    const isAuthor = canAccessUnpublishedContent(actor);

    const rows = await this.prisma.test.findMany({
      where: {
        materialId: params.materialId,
        deletedAt: null,
        ...(!isAuthor ? { status: ContentStatus.PUBLISHED } : {}),
      },
      orderBy: [{ number: 'asc' }, { createdAt: 'asc' }],
      include: {
        gameModuleVersion: {
          include: {
            gameModule: true,
          },
        },
      },
    });

    return rows.map((row) => {
      const gmv = row.gameModuleVersion;
      const manifestObj =
        gmv?.manifest && typeof gmv.manifest === 'object'
          ? (gmv.manifest as Record<string, unknown>)
          : {};
      const maxScore = typeof manifestObj.max_score === 'number' ? manifestObj.max_score : row.points;

      return {
        id: row.id,
        materialId: row.materialId,
        number: row.number,
        title: row.title,
        questionType: row.questionType as QuestionTypeDto,
        prompt: row.prompt,
        points: row.points,
        difficulty: row.difficulty.toLowerCase() as DifficultyTypeDto,
        bloomLevel: row.bloomLevel.toLowerCase() as BloomLevelDto,
        maxAttempts: row.maxAttempts,
        gameModuleVersionId: row.gameModuleVersionId,
        gameModule: gmv
          ? {
              versionId: gmv.id,
              gameModuleId: gmv.gameModuleId,
              moduleSlug: gmv.gameModule.slug,
              moduleName: gmv.gameModule.name,
              source: gmv.gameModule.source.toLowerCase() as 'template' | 'custom',
              templateId: gmv.gameModule.templateId,
              version: gmv.version,
              maxScore,
              config:
                gmv.config && typeof gmv.config === 'object'
                  ? (gmv.config as Record<string, unknown>)
                  : {},
            }
          : null,
        payload: (row.payload as Record<string, unknown> | null) ?? null,
      };
    });
  }

  async getTestDetail(
    params: TestIdParamDto,
    actor: ActorContext | null,
  ): Promise<
    PracticeCaseStudyItemDto & {
      gameModuleVersionId: string | null;
      gameModule: QuizGameModuleSummaryDto | null;
    }
  > {
    const isAuthor = canAccessUnpublishedContent(actor);

    const row = await this.prisma.test.findFirst({
      where: {
        id: params.testId,
        deletedAt: null,
        ...(!isAuthor ? { status: ContentStatus.PUBLISHED } : {}),
      },
      include: {
        testCases: {
          where: { isHidden: false },
          orderBy: { id: 'asc' },
        },
        hints: {
          orderBy: { level: 'asc' },
          select: { id: true, level: true, type: true },
        },
        gameModuleVersion: {
          include: { gameModule: true },
        },
      },
    });

    if (!row) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Soal atau Quiz tidak ditemukan',
        }),
      );
    }

    const gmv = row.gameModuleVersion;
    const manifestObj =
      gmv?.manifest && typeof gmv.manifest === 'object'
        ? (gmv.manifest as Record<string, unknown>)
        : {};
    const maxScore = typeof manifestObj.max_score === 'number' ? manifestObj.max_score : row.points;

    return {
      id: row.id,
      materialId: row.materialId,
      number: row.number,
      title: row.title,
      questionType: row.questionType as QuestionTypeDto,
      prompt: row.prompt,
      points: row.points,
      difficulty: row.difficulty.toLowerCase() as DifficultyTypeDto,
      bloomLevel: row.bloomLevel.toLowerCase() as BloomLevelDto,
      maxAttempts: row.maxAttempts,
      gameModuleVersionId: row.gameModuleVersionId,
      gameModule: gmv
        ? {
            versionId: gmv.id,
            gameModuleId: gmv.gameModuleId,
            moduleSlug: gmv.gameModule.slug,
            moduleName: gmv.gameModule.name,
            source: gmv.gameModule.source.toLowerCase() as 'template' | 'custom',
            templateId: gmv.gameModule.templateId,
            version: gmv.version,
            maxScore,
            config:
              gmv.config && typeof gmv.config === 'object'
                ? (gmv.config as Record<string, unknown>)
                : {},
          }
        : null,
      payload: (row.payload as Record<string, unknown> | null) ?? null,
      sampleTestCases: row.testCases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      })),
      availableHints: row.hints.map((h) => ({
        id: h.id,
        level: h.level,
        type: h.type.toLowerCase() as HintTypeDto,
      })),
    };
  }

  // ==========================================
  // AUTHORING: TEST / PRACTICE / QUIZ CRUD (GURU & ADMIN)
  // ==========================================

  async createTest(dto: CreateTestDto, actor: ActorContext | null) {
    const authActor = assertAuthorRole(actor);

    const material = await this.prisma.material.findFirst({
      where: { id: dto.materialId, deletedAt: null },
    });
    if (!material) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Materi untuk soal ini tidak ditemukan',
        }),
      );
    }

    // FR-15: Jika menautkan ke GameModuleVersion, wajib versi yang sudah PUBLISHED
    if (dto.gameModuleVersionId) {
      const gmv = await this.prisma.gameModuleVersion.findUnique({
        where: { id: dto.gameModuleVersionId },
      });
      if (!gmv || gmv.status !== VersionStatus.PUBLISHED) {
        throw new RpcException(
          createServiceError({
            code: 'VALIDATION_ERROR',
            httpStatus: 400,
            message: 'Quiz hanya dapat ditautkan ke versi Game Module yang sudah berstatus PUBLISHED',
          }),
        );
      }
    }

    const created = await this.prisma.test.create({
      data: {
        materialId: dto.materialId,
        gameModuleVersionId: dto.gameModuleVersionId ?? null,
        createdBy: authActor.userId,
        number: dto.number,
        title: dto.title,
        questionType: dto.questionType,
        prompt: dto.prompt,
        points: dto.points,
        difficulty: dto.difficulty.toUpperCase() as DifficultyType,
        bloomLevel: dto.bloomLevel.toUpperCase() as BloomLevel,
        maxAttempts: dto.maxAttempts ?? null,
        payload: (dto.payload ?? undefined) as Prisma.InputJsonValue | undefined,
        answerKey: (dto.answerKey ?? undefined) as Prisma.InputJsonValue | undefined,
        status: toContentStatusPrisma(dto.status),
        ...(dto.hints?.length
          ? {
              hints: {
                create: dto.hints.map((h) => ({
                  level: h.level,
                  type: h.type.toUpperCase() as HintType,
                  content: h.content,
                })),
              },
            }
          : {}),
        ...(dto.testCases?.length
          ? {
              testCases: {
                create: dto.testCases.map((tc) => ({
                  input: tc.input,
                  expectedOutput: tc.expectedOutput,
                  weight: tc.weight,
                  isHidden: tc.isHidden,
                })),
              },
            }
          : {}),
      },
    });

    return this.getTestDetail({ testId: created.id }, actor);
  }

  async updateTest(dto: UpdateTestPayloadDto, actor: ActorContext | null) {
    assertAuthorRole(actor);

    const existing = await this.prisma.test.findFirst({
      where: { id: dto.testId, deletedAt: null },
    });
    if (!existing) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Soal atau Quiz tidak ditemukan',
        }),
      );
    }

    if (dto.gameModuleVersionId) {
      const gmv = await this.prisma.gameModuleVersion.findUnique({
        where: { id: dto.gameModuleVersionId },
      });
      if (!gmv || gmv.status !== VersionStatus.PUBLISHED) {
        throw new RpcException(
          createServiceError({
            code: 'VALIDATION_ERROR',
            httpStatus: 400,
            message: 'Quiz hanya dapat ditautkan ke versi Game Module yang sudah berstatus PUBLISHED',
          }),
        );
      }
    }

    await this.prisma.test.update({
      where: { id: dto.testId },
      data: {
        ...(dto.gameModuleVersionId !== undefined ? { gameModuleVersionId: dto.gameModuleVersionId } : {}),
        ...(dto.number !== undefined ? { number: dto.number } : {}),
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.questionType !== undefined ? { questionType: dto.questionType } : {}),
        ...(dto.prompt !== undefined ? { prompt: dto.prompt } : {}),
        ...(dto.points !== undefined ? { points: dto.points } : {}),
        ...(dto.difficulty !== undefined ? { difficulty: dto.difficulty.toUpperCase() as DifficultyType } : {}),
        ...(dto.bloomLevel !== undefined ? { bloomLevel: dto.bloomLevel.toUpperCase() as BloomLevel } : {}),
        ...(dto.maxAttempts !== undefined ? { maxAttempts: dto.maxAttempts } : {}),
        ...(dto.payload !== undefined ? { payload: (dto.payload ?? undefined) as Prisma.InputJsonValue | undefined } : {}),
        ...(dto.answerKey !== undefined ? { answerKey: (dto.answerKey ?? undefined) as Prisma.InputJsonValue | undefined } : {}),
        ...(dto.status !== undefined ? { status: toContentStatusPrisma(dto.status) } : {}),
      },
    });

    return this.getTestDetail({ testId: dto.testId }, actor);
  }

  async deleteTest(params: TestIdParamDto, actor: ActorContext | null): Promise<MutationResultDto> {
    assertAuthorRole(actor);

    const existing = await this.prisma.test.findFirst({
      where: { id: params.testId, deletedAt: null },
    });
    if (!existing) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Soal atau Quiz tidak ditemukan',
        }),
      );
    }

    await this.prisma.test.update({
      where: { id: params.testId },
      data: { deletedAt: new Date() },
    });

    return { success: true, id: params.testId, message: 'Soal/Quiz berhasil dihapus (soft-delete)' };
  }

  // ==========================================
  // INTERNAL TCP HANDLERS (UNTUK AI-SERVICE & PROGRESS-SERVICE)
  // ==========================================

  async getTestHintContextInternal(
    params: TestIdParamDto,
  ): Promise<TestHintContextInternalDto & { payload: Record<string, unknown> | null }> {
    const row = await this.prisma.test.findFirst({
      where: { id: params.testId, deletedAt: null },
      include: {
        hints: { orderBy: { level: 'asc' } },
        gameModuleVersion: true,
      },
    });

    if (!row) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Soal tidak ditemukan untuk konteks AI Hint',
        }),
      );
    }

    const rawPayload =
      (row.payload as Record<string, unknown> | null) ??
      (row.gameModuleVersion?.config as Record<string, unknown> | null) ??
      null;

    return {
      id: row.id,
      materialId: row.materialId,
      questionType: row.questionType,
      prompt: row.prompt,
      difficulty: row.difficulty.toLowerCase() as DifficultyTypeDto,
      bloomLevel: row.bloomLevel.toLowerCase() as BloomLevelDto,
      payload: rawPayload,
      staticHints: row.hints.map((h) => ({
        level: h.level,
        type: h.type.toLowerCase() as 'pseudocode' | 'cloze_code' | 'full_code',
        content: h.content,
      })),
    };
  }

  async getTestForEvaluationInternal(params: TestIdParamDto): Promise<TestForEvaluationInternalDto> {
    const row = await this.prisma.test.findFirst({
      where: { id: params.testId, deletedAt: null },
      include: {
        rubric: true,
        testCases: { orderBy: { id: 'asc' } },
      },
    });

    if (!row) {
      throw new RpcException(
        createServiceError({
          code: 'NOT_FOUND',
          httpStatus: 404,
          message: 'Soal tidak ditemukan untuk evaluasi',
        }),
      );
    }

    return {
      id: row.id,
      materialId: row.materialId,
      questionType: row.questionType,
      points: row.points,
      difficulty: row.difficulty.toLowerCase() as DifficultyTypeDto,
      maxAttempts: row.maxAttempts,
      status: toContentStatusDto(row.status),
      answerKey: (row.answerKey as Record<string, unknown> | null) ?? null,
      rubric: row.rubric
        ? {
            id: row.rubric.id,
            prompt: row.rubric.prompt,
            maxScore: row.rubric.maxScore,
          }
        : null,
      testCases: row.testCases.map((tc) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        weight: tc.weight,
        isHidden: tc.isHidden,
      })),
    };
  }

  // ==========================================
  // KATALOG GAMIFIKASI: CHALLENGE & BADGE
  // ==========================================

  async listChallenges(query: ListChallengesQueryDto): Promise<ChallengeCatalogItemDto[]> {
    const rows = await this.prisma.challenge.findMany({
      where: {
        ...(query.onlyActive ? { isActive: true } : {}),
        OR: [{ educationLevel: { code: query.level } }, { educationLevelId: null }],
      },
      include: {
        educationLevel: { select: { code: true } },
        tiers: {
          orderBy: { threshold: 'asc' },
          include: {
            badge: { include: { iconAsset: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      type: row.type.toLowerCase() as ChallengeCatalogItemDto['type'],
      educationLevelCode: row.educationLevel?.code ?? null,
      title: row.title,
      description: row.description,
      period: row.period,
      gameModuleVersionId: row.gameModuleVersionId,
      maxScore: row.maxScore,
      isActive: row.isActive,
      tiers: row.tiers.map((t) => ({
        id: t.id,
        tier: t.tier.toLowerCase() as 'bronze' | 'silver' | 'gold',
        threshold: t.threshold,
        rewardExp: t.rewardExp,
        badge: t.badge
          ? {
              id: t.badge.id,
              code: t.badge.code,
              name: t.badge.name,
              description: t.badge.description,
              criteria: (t.badge.criteria as Record<string, unknown> | null) ?? null,
              targetValue: t.badge.targetValue,
              iconAsset: toAssetSummaryDto(t.badge.iconAsset),
            }
          : null,
      })),
    }));
  }

  async listBadges(): Promise<BadgeCatalogItemDto[]> {
    const rows = await this.prisma.badge.findMany({
      include: { iconAsset: true },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((b) => ({
      id: b.id,
      code: b.code,
      name: b.name,
      description: b.description,
      criteria: (b.criteria as Record<string, unknown> | null) ?? null,
      targetValue: b.targetValue,
      iconAsset: toAssetSummaryDto(b.iconAsset),
    }));
  }
}
