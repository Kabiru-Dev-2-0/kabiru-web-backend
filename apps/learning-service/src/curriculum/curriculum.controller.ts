import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateMaterialSchema,
  CreateSubjectSchema,
  CreateTopicSchema,
  GetMaterialDetailParamsSchema,
  LEARNING_PATTERNS,
  ListMaterialsQuerySchema,
  ListSubjectsQuerySchema,
  ListTopicsQuerySchema,
  MaterialIdParamSchema,
  SubjectIdParamSchema,
  TopicIdParamSchema,
  UpdateMaterialPayloadSchema,
  UpdateSubjectPayloadSchema,
  UpdateTopicPayloadSchema,
  type CreateMaterialDto,
  type CreateSubjectDto,
  type CreateTopicDto,
  type EducationLevelItemDto,
  type MaterialAuthoringDetailDto,
  type MaterialDetailDto,
  type MaterialListItemDto,
  type MutationResultDto,
  type SubjectItemDto,
  type TopicItemDto,
  type UpdateMaterialPayloadDto,
  type UpdateSubjectPayloadDto,
  type UpdateTopicPayloadDto,
} from '@kabiru/contracts';
import { extractActor, validateRpcData } from '../common/rpc-validation.util';
import { CurriculumService, type PaginatedResult } from './curriculum.service';

@Controller()
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

  // ==========================================
  // READ HANDLERS
  // ==========================================
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
  listMaterials(@Payload() payload: unknown): Promise<PaginatedResult<MaterialListItemDto>> {
    const query = validateRpcData(ListMaterialsQuerySchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.listMaterials(query, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.MATERIAL_GET_DETAIL)
  getMaterialDetail(@Payload() payload: unknown): Promise<MaterialDetailDto> {
    const params = validateRpcData(GetMaterialDetailParamsSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.getMaterialDetail(params, actor);
  }

  // ==========================================
  // AUTHORING CRUD HANDLERS
  // ==========================================
  @MessagePattern(LEARNING_PATTERNS.SUBJECT_CREATE)
  createSubject(@Payload() payload: unknown): Promise<SubjectItemDto> {
    const data = validateRpcData(CreateSubjectSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.createSubject(data, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.SUBJECT_UPDATE)
  updateSubject(@Payload() payload: unknown): Promise<SubjectItemDto> {
    const data = validateRpcData(UpdateSubjectPayloadSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.updateSubject(data, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.SUBJECT_DELETE)
  deleteSubject(@Payload() payload: unknown): Promise<MutationResultDto> {
    const data = validateRpcData(SubjectIdParamSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.deleteSubject(data, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.TOPIC_CREATE)
  createTopic(@Payload() payload: unknown): Promise<TopicItemDto> {
    const data = validateRpcData(CreateTopicSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.createTopic(data, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.TOPIC_UPDATE)
  updateTopic(@Payload() payload: unknown): Promise<TopicItemDto> {
    const data = validateRpcData(UpdateTopicPayloadSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.updateTopic(data, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.TOPIC_DELETE)
  deleteTopic(@Payload() payload: unknown): Promise<MutationResultDto> {
    const data = validateRpcData(TopicIdParamSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.deleteTopic(data, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.MATERIAL_CREATE)
  createMaterial(@Payload() payload: unknown): Promise<MaterialListItemDto> {
    const data = validateRpcData(CreateMaterialSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.createMaterial(data, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.MATERIAL_UPDATE)
  updateMaterial(@Payload() payload: unknown): Promise<MaterialListItemDto> {
    const data = validateRpcData(UpdateMaterialPayloadSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.updateMaterial(data, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.MATERIAL_DELETE)
  deleteMaterial(@Payload() payload: unknown): Promise<MutationResultDto> {
    const data = validateRpcData(MaterialIdParamSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.deleteMaterial(data, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.MATERIAL_GET_AUTHORING)
  getMaterialAuthoringDetail(@Payload() payload: unknown): Promise<MaterialAuthoringDetailDto> {
    const data = validateRpcData(MaterialIdParamSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.getMaterialAuthoringDetail(data, actor);
  }
}