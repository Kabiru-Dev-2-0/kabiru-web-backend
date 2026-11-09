import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  CreateGameModuleSchema,
  CreateGameVersionDraftSchema,
  GAME_PATTERNS,
  GameModuleIdParamSchema,
  GameTemplateIdParamSchema,
  GameVersionIdParamSchema,
  GetGamePlayerPayloadSchema,
  ListGameModulesQuerySchema,
  ListGameTemplatesQuerySchema,
  PublishGameVersionSchema,
  SaveCustomFilesPayloadSchema,
  UpdateGameModulePayloadSchema,
  UpdateGameVersionConfigSchema,
  type GameModuleDetailDto,
  type GameModuleListItemDto,
  type GameModuleVersionDetailDto,
  type GamePlayerPayloadDto,
  type GameTemplateDetailDto,
  type GameTemplateListItemDto,
  type MutationResultDto,
} from '@kabiru/contracts';
import { extractActor, validateRpcData } from '../common/rpc-validation.util';
import type { PaginatedResult } from '../curriculum/curriculum.service';
import { GameModuleService } from './game-module.service';

@Controller()
export class GameModuleController {
  constructor(private readonly gameModuleService: GameModuleService) {}

  // ==========================================
  // 1. TEMPLATE CATALOG
  // ==========================================

  @MessagePattern(GAME_PATTERNS.TEMPLATE_LIST)
  listTemplates(@Payload() payload: unknown): Promise<GameTemplateListItemDto[]> {
    const query = validateRpcData(ListGameTemplatesQuerySchema, payload);
    return this.gameModuleService.listTemplates(query);
  }

  @MessagePattern(GAME_PATTERNS.TEMPLATE_GET_DETAIL)
  getTemplateDetail(@Payload() payload: unknown): Promise<GameTemplateDetailDto> {
    const params = validateRpcData(GameTemplateIdParamSchema, payload);
    return this.gameModuleService.getTemplateDetail(params);
  }

  // ==========================================
  // 2. GAME MODULE CRUD
  // ==========================================

  @MessagePattern(GAME_PATTERNS.MODULE_LIST)
  listModules(@Payload() payload: unknown): Promise<PaginatedResult<GameModuleListItemDto>> {
    const query = validateRpcData(ListGameModulesQuerySchema, payload);
    const actor = extractActor(payload);
    return this.gameModuleService.listModules(query, actor);
  }

  @MessagePattern(GAME_PATTERNS.MODULE_GET_DETAIL)
  getModuleDetail(@Payload() payload: unknown): Promise<GameModuleDetailDto> {
    const params = validateRpcData(GameModuleIdParamSchema, payload);
    const actor = extractActor(payload);
    return this.gameModuleService.getModuleDetail(params, actor);
  }

  @MessagePattern(GAME_PATTERNS.MODULE_CREATE)
  createModule(@Payload() payload: unknown): Promise<GameModuleDetailDto> {
    const data = validateRpcData(CreateGameModuleSchema, payload);
    const actor = extractActor(payload);
    return this.gameModuleService.createModule(data, actor);
  }

  @MessagePattern(GAME_PATTERNS.MODULE_UPDATE)
  updateModule(@Payload() payload: unknown): Promise<GameModuleDetailDto> {
    const data = validateRpcData(UpdateGameModulePayloadSchema, payload);
    const actor = extractActor(payload);
    return this.gameModuleService.updateModule(data, actor);
  }

  @MessagePattern(GAME_PATTERNS.MODULE_DELETE)
  deleteModule(@Payload() payload: unknown): Promise<MutationResultDto> {
    const params = validateRpcData(GameModuleIdParamSchema, payload);
    const actor = extractActor(payload);
    return this.gameModuleService.deleteModule(params, actor);
  }

  // ==========================================
  // 3. VERSIONING & STUDIO AUTHORING
  // ==========================================

  @MessagePattern(GAME_PATTERNS.VERSION_CREATE_DRAFT)
  createVersionDraft(@Payload() payload: unknown): Promise<GameModuleVersionDetailDto> {
    const data = validateRpcData(CreateGameVersionDraftSchema, payload);
    const actor = extractActor(payload);
    return this.gameModuleService.createVersionDraft(data, actor);
  }

  @MessagePattern(GAME_PATTERNS.VERSION_GET_DETAIL)
  getVersionDetail(@Payload() payload: unknown): Promise<GameModuleVersionDetailDto> {
    const params = validateRpcData(GameVersionIdParamSchema, payload);
    const actor = extractActor(payload);
    return this.gameModuleService.getVersionDetail(params, actor);
  }

  @MessagePattern(GAME_PATTERNS.VERSION_UPDATE_CONFIG)
  updateVersionConfig(@Payload() payload: unknown): Promise<GameModuleVersionDetailDto> {
    const data = validateRpcData(UpdateGameVersionConfigSchema, payload);
    const actor = extractActor(payload);
    return this.gameModuleService.updateVersionConfig(data, actor);
  }

  @MessagePattern(GAME_PATTERNS.VERSION_SAVE_CUSTOM_FILES)
  saveCustomFiles(@Payload() payload: unknown): Promise<GameModuleVersionDetailDto> {
    const data = validateRpcData(SaveCustomFilesPayloadSchema, payload);
    const actor = extractActor(payload);
    return this.gameModuleService.saveCustomFiles(data, actor);
  }

  @MessagePattern(GAME_PATTERNS.VERSION_PUBLISH)
  publishVersion(@Payload() payload: unknown): Promise<GameModuleVersionDetailDto> {
    const data = validateRpcData(PublishGameVersionSchema, payload);
    const actor = extractActor(payload);
    return this.gameModuleService.publishVersion(data, actor);
  }

  // ==========================================
  // 4. PLAYER EXECUTION (LMS IFRAME RUNTIME)
  // ==========================================

  @MessagePattern(GAME_PATTERNS.PLAYER_GET_PAYLOAD)
  getPlayerPayload(@Payload() payload: unknown): Promise<GamePlayerPayloadDto> {
    const params = validateRpcData(GetGamePlayerPayloadSchema, payload);
    const actor = extractActor(payload);
    return this.gameModuleService.getPlayerPayload(params, actor);
  }
}
