import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ContentStatus, VisibilityType, type Prisma } from '@prisma/client';
import {
  EDUCATION_LEVEL_CODES,
  createServiceError,
  type ActorContext,
  type CreateMaterialDto,
  type CreateSubjectDto,
  type CreateTopicDto,
  type EducationLevelItemDto,
  type GetMaterialDetailParamsDto,
  type ListMaterialsQueryDto,
  type ListSubjectsQueryDto,
  type ListTopicsQueryDto,
  type MaterialAuthoringDetailDto,
  type MaterialDetailDto,
  type MaterialIdParamDto,
  type MaterialListItemDto,
  type MutationResultDto,
  type PaginationMeta,
  type SubjectIdParamDto,
  type SubjectItemDto,
  type TopicIdParamDto,
  type TopicItemDto,
  type UpdateMaterialPayloadDto,
  type UpdateSubjectPayloadDto,
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
}