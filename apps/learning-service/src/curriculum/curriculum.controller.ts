import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  LEARNING_PATTERNS,
  ListMaterialsQuerySchema,
  ListSubjectsQuerySchema,
  ListTopicsQuerySchema,
  type EducationLevelItemDto,
  type MaterialListItemDto,
  type SubjectItemDto,
  type TopicItemDto,
} from '@kabiru/contracts';
import { extractActor, validateRpcData } from '../common/rpc-validation.util';
import { CurriculumService, type PaginatedResult } from './curriculum.service';

@Controller()
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

  @MessagePattern(LEARNING_PATTERNS.EDUCATION_LEVEL_LIST)
  listEducationLevels(): Promise<EducationLevelItemDto[]> {
    return this.curriculumService.listEducationLevels();
  }

  @MessagePattern(LEARNING_PATTERNS.SUBJECT_LIST)
  listSubjects(@Payload() payload: unknown): Promise<SubjectItemDto[]> {
    const query = validateRpcData(ListSubjectsQuerySchema, payload);
    return this.curriculumService.listSubjects(query);
  }

  @MessagePattern(LEARNING_PATTERNS.TOPIC_LIST)
  listTopics(@Payload() payload: unknown): Promise<PaginatedResult<TopicItemDto>> {
    const query = validateRpcData(ListTopicsQuerySchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.listTopics(query, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.MATERIAL_LIST)
  listMaterials(
    @Payload() payload: unknown,
  ): Promise<PaginatedResult<MaterialListItemDto>> {
    const query = validateRpcData(ListMaterialsQuerySchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.listMaterials(query, actor);
  }
}