import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { ContentStatus, VisibilityType, type Prisma } from '@prisma/client';
import {
  EDUCATION_LEVEL_CODES,
  createServiceError,
  type ActorContext,
  type EducationLevelItemDto,
  type GetMaterialDetailParamsDto,
  type ListMaterialsQueryDto,
  type ListSubjectsQueryDto,
  type ListTopicsQueryDto,
  type MaterialDetailDto,
  type MaterialListItemDto,
  type PaginationMeta,
  type SubjectItemDto,
  type TopicItemDto,
} from '@kabiru/contracts';
import { canAccessUnpublishedContent } from '../common/rpc-validation.util';
import { PrismaService } from '../prisma/prisma.service';
import {
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
}