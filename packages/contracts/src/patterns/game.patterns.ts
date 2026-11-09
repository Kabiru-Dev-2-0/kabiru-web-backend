export const GAME_PATTERNS = {
  // Template Catalog (Untuk Guru & Dev)
  TEMPLATE_LIST: 'game.template.list',
  TEMPLATE_GET_DETAIL: 'game.template.getDetail',

  // Game Module CRUD (Teacher/Dev/Admin)
  MODULE_LIST: 'game.module.list',
  MODULE_GET_DETAIL: 'game.module.getDetail',
  MODULE_CREATE: 'game.module.create',
  MODULE_UPDATE: 'game.module.update',
  MODULE_DELETE: 'game.module.delete',

  // Versioning & Studio Authoring
  VERSION_CREATE_DRAFT: 'game.version.createDraft',
  VERSION_GET_DETAIL: 'game.version.getDetail',
  VERSION_UPDATE_CONFIG: 'game.version.updateConfig',
  VERSION_SAVE_CUSTOM_FILES: 'game.version.saveCustomFiles',
  VERSION_PUBLISH: 'game.version.publish',

  // Player Execution (LMS Runtime - Dimainkan Siswa)
  PLAYER_GET_PAYLOAD: 'game.player.getPayload',
} as const;

export type GamePattern = (typeof GAME_PATTERNS)[keyof typeof GAME_PATTERNS];

