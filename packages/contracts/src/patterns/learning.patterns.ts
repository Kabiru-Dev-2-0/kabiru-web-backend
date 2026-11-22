export const LEARNING_PATTERNS = {
  HEALTH_CHECK: 'learning.health.check',

  // Public / Student & Teacher Read (Eksplorasi, Detail Eksplorasi, Belajar/Duolingo, Detail Materi)
  EDUCATION_LEVEL_LIST: 'learning.educationLevel.list',
  SUBJECT_LIST: 'learning.subject.list',
  TOPIC_LIST: 'learning.topic.list',
  MATERIAL_LIST: 'learning.material.list',
  MATERIAL_GET_DETAIL: 'learning.material.getDetail',

  // Authoring CRUD (Teacher, Admin, Developer)
  SUBJECT_CREATE: 'learning.subject.create',
  SUBJECT_UPDATE: 'learning.subject.update',
  SUBJECT_DELETE: 'learning.subject.delete',
  TOPIC_CREATE: 'learning.topic.create',
  TOPIC_UPDATE: 'learning.topic.update',
  TOPIC_DELETE: 'learning.topic.delete',
  MATERIAL_CREATE: 'learning.material.create',
  MATERIAL_UPDATE: 'learning.material.update',
  MATERIAL_DELETE: 'learning.material.delete',
  MATERIAL_GET_AUTHORING: 'learning.material.getAuthoringDetail',

  // Shared LMS Asset Storage (Topic Cover, Material Cover, Badge Icon, Documents)
  ASSET_UPLOAD: 'learning.asset.upload',
  ASSET_GET_DETAIL: 'learning.asset.getDetail',

  // Internal Service-to-Service ONLY (Never expose via HTTP Gateway)
  INTERNAL_TEST_GET_FOR_EVAL: 'learning.internal.test.getForEvaluation',
  INTERNAL_TEST_GET_HINT_CTX: 'learning.internal.test.getHintContext',
  INTERNAL_EDU_LEVEL_VERIFY: 'learning.internal.educationLevel.verify',

  // 6. SMA - Practice Studi Kasus & 7. SMA - Quiz (Student & Teacher Read)
  PRACTICE_LIST_BY_MATERIAL: 'learning.practice.listByMaterial',
  QUIZ_LIST_BY_MATERIAL: 'learning.quiz.listByMaterial',
  TEST_GET_DETAIL: 'learning.test.getDetail',
  TEST_GET_HINT_BY_LEVEL: 'learning.test.getHintByLevel',

  // Authoring CRUD Soal / Practice / Quiz (Teacher, Admin, Developer)
  TEST_CREATE: 'learning.test.create',
  TEST_UPDATE: 'learning.test.update',
  TEST_DELETE: 'learning.test.delete',

  // Katalog Gamifikasi (Challenge & Badge SMA)
  CHALLENGE_LIST: 'learning.challenge.list',
  BADGE_LIST: 'learning.badge.list',
} as const;

export type LearningPattern = (typeof LEARNING_PATTERNS)[keyof typeof LEARNING_PATTERNS];