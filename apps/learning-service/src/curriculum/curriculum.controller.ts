import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateMaterialSchema,
  CreateSubjectSchema,
  CreateTestSchema,
  CreateTopicSchema,
  GetMaterialDetailParamsSchema,
  GetTestHintParamsSchema,
  LEARNING_PATTERNS,
  ListChallengesQuerySchema,
  ListMaterialsQuerySchema,
  ListSubjectsQuerySchema,
  ListTopicsQuerySchema,
  MaterialIdParamSchema,
  SubjectIdParamSchema,
  TestIdParamSchema,
  TopicIdParamSchema,
  UpdateMaterialPayloadSchema,
  UpdateSubjectPayloadSchema,
  UpdateTestPayloadSchema,
  UpdateTopicPayloadSchema,
  type EducationLevelItemDto,
  type MaterialAuthoringDetailDto,
  type MaterialDetailDto,
  type MaterialListItemDto,
  type MutationResultDto,
  type SubjectItemDto,
  type TopicItemDto,
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

  // ==========================================
  // 6. PRACTICE STUDI KASUS & 7. QUIZ HANDLERS
  // ==========================================
  @MessagePattern(LEARNING_PATTERNS.PRACTICE_LIST_BY_MATERIAL)
  listPracticesByMaterial(@Payload() payload: unknown) {
    const params = validateRpcData(MaterialIdParamSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.listPracticesByMaterial(params, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.QUIZ_LIST_BY_MATERIAL)
  listQuizzesByMaterial(@Payload() payload: unknown) {
    const params = validateRpcData(MaterialIdParamSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.listQuizzesByMaterial(params, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.TEST_GET_DETAIL)
  getTestDetail(@Payload() payload: unknown) {
    const params = validateRpcData(TestIdParamSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.getTestDetail(params, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.TEST_GET_HINT_BY_LEVEL)
  getTestHintByLevel(@Payload() payload: unknown) {
    const params = validateRpcData(GetTestHintParamsSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.getTestHintByLevel(params, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.TEST_CREATE)
  createTest(@Payload() payload: unknown) {
    const data = validateRpcData(CreateTestSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.createTest(data, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.TEST_UPDATE)
  updateTest(@Payload() payload: unknown) {
    const data = validateRpcData(UpdateTestPayloadSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.updateTest(data, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.TEST_DELETE)
  deleteTest(@Payload() payload: unknown) {
    const params = validateRpcData(TestIdParamSchema, payload);
    const actor = extractActor(payload);
    return this.curriculumService.deleteTest(params, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.CHALLENGE_LIST)
  listChallenges(@Payload() payload: unknown) {
    const query = validateRpcData(ListChallengesQuerySchema, payload);
    return this.curriculumService.listChallenges(query);
  }

  @MessagePattern(LEARNING_PATTERNS.BADGE_LIST)
  listBadges() {
    return this.curriculumService.listBadges();
  }

  // ==========================================
  // INTERNAL SERVICE-TO-SERVICE HANDLERS
  // ==========================================
  @MessagePattern(LEARNING_PATTERNS.INTERNAL_TEST_GET_HINT_CTX)
  getTestHintContextInternal(@Payload() payload: unknown) {
    const params = validateRpcData(TestIdParamSchema, payload);
    return this.curriculumService.getTestHintContextInternal(params);
  }

  @MessagePattern(LEARNING_PATTERNS.INTERNAL_TEST_GET_FOR_EVAL)
  getTestForEvaluationInternal(@Payload() payload: unknown) {
    const params = validateRpcData(TestIdParamSchema, payload);
    return this.curriculumService.getTestForEvaluationInternal(params);
  }
}