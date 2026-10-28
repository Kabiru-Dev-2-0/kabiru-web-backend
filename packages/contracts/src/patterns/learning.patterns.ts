export const LEARNING_PATTERNS = {
  HEALTH_CHECK: 'learning.health.check',

  // Public / Student & Teacher Read (Belajar & Detail Belajar)
  EDUCATION_LEVEL_LIST: 'learning.educationLevel.list',
  CURRICULUM_LIST: 'learning.curriculum.list',
  SUBJECT_LIST: 'learning.subject.list',
  TOPIC_LIST_BY_SUBJECT: 'learning.topic.listBySubject',
  MATERIAL_LIST_BY_TOPIC: 'learning.material.listByTopic',
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

  // Internal Service-to-Service ONLY (Never expose via HTTP Gateway)
  INTERNAL_TEST_GET_FOR_EVAL: 'learning.internal.test.getForEvaluation',
  INTERNAL_TEST_GET_HINT_CTX: 'learning.internal.test.getHintContext',
  INTERNAL_EDU_LEVEL_VERIFY: 'learning.internal.educationLevel.verify',
} as const;

export type LearningPattern = (typeof LEARNING_PATTERNS)[keyof typeof LEARNING_PATTERNS];