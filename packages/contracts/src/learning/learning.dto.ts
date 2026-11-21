import type { EducationLevelCode } from '../common/envelope';

export type ContentStatusDto = 'draft' | 'published' | 'archived';
export type DifficultyTypeDto = 'easy' | 'medium' | 'hard';
export type BloomLevelDto = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
export type AssetKindDto = 'image' | 'audio' | 'script' | 'bundle' | 'document';
export type HintTypeDto = 'pseudocode' | 'cloze_code' | 'full_code';
export type QuestionTypeDto =
  | 'multiple_choice'
  | 'fill_blank'
  | 'drag_drop'
  | 'sorting'
  | 'true_false'
  | 'multi_select'
  | 'checkbox'
  | 'pattern_painter'
  | 'maze_runner'
  | 'code_debugger'
  | 'case_study';

export interface AssetSummaryDto {
  id: string;
  kind: AssetKindDto;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}

// 1. GET /learning/education-levels
export interface EducationLevelItemDto {
  id: string;
  code: EducationLevelCode;
  name: string;
}

// 2. GET /learning/subjects?level=SMA (Page Eksplorasi)
export interface SubjectItemDto {
  id: string;
  educationLevelId: string;
  educationLevelCode: EducationLevelCode;
  name: string;
  publishedTopicCount: number;
}

// 3. GET /learning/topics?level=SMA&subjectId=... (Page Detail Eksplorasi & Page Belajar)
export interface TopicItemDto {
  id: string;
  subjectId: string;
  subjectName: string;
  number: number;
  title: string;
  description: string | null;
  coverAsset: AssetSummaryDto | null;
  status: ContentStatusDto;
  publishedMaterialCount: number;
}

// 4. GET /learning/materials?topicId=... (Page Belajar / Jalur Duolingo)
export interface MaterialListItemDto {
  id: string;
  topicId: string;
  number: number;
  title: string;
  description: string | null;
  learningOutcome: string | null;
  summary: string | null;
  coverAsset: AssetSummaryDto | null;
  status: ContentStatusDto;
  publishedTestCount: number;
  updatedAt: string;
}

export interface PublicTestCaseDto {
  id: string;
  input: string;
  expectedOutput: string;
}

export interface TestPublicItemDto {
  id: string;
  number: number;
  title: string;
  questionType: QuestionTypeDto;
  prompt: string;
  points: number;
  difficulty: DifficultyTypeDto;
  bloomLevel: BloomLevelDto;
  maxAttempts: number | null;
  gameModuleVersionId: string | null;
  payload: Record<string, unknown> | null;
  sampleTestCases: PublicTestCaseDto[];
}

// 5. GET /learning/materials/:materialId (Detail Belajar & Daftar Soal Aman)
export interface MaterialDetailDto {
  id: string;
  number: number;
  title: string;
  description: string | null;
  learningOutcome: string | null;
  content: string;
  summary: string | null;
  coverAsset: AssetSummaryDto | null;
  status: ContentStatusDto;
  breadcrumb: {
    educationLevelCode: string;
    subjectId: string;
    subjectName: string;
    topicId: string;
    topicNumber: number;
    topicTitle: string;
  };
  navigation: {
    previousMaterialId: string | null;
    nextMaterialId: string | null;
  };
  tests: TestPublicItemDto[];
  createdAt: string;
  updatedAt: string;
}

export interface TestForEvaluationInternalDto {
  id: string;
  materialId: string;
  questionType: string;
  points: number;
  difficulty: DifficultyTypeDto;
  maxAttempts: number | null;
  status: ContentStatusDto;
  answerKey: Record<string, unknown> | null;
  rubric: {
    id: string;
    prompt: string | null;
    maxScore: number;
  } | null;
  testCases: Array<{
    id: string;
    input: string;
    expectedOutput: string;
    weight: number;
    isHidden: boolean;
  }>;
}

export interface TestHintContextInternalDto {
  id: string;
  materialId: string;
  questionType: string;
  prompt: string;
  difficulty: DifficultyTypeDto;
  bloomLevel: BloomLevelDto;
  staticHints: Array<{
    level: number;
    type: 'pseudocode' | 'cloze_code' | 'full_code';
    content: string;
  }>;
}

export interface TestAuthoringItemDto {
  id: string;
  number: number;
  title: string;
  questionType: QuestionTypeDto;
  prompt: string;
  points: number;
  difficulty: DifficultyTypeDto;
  bloomLevel: BloomLevelDto;
  maxAttempts: number | null;
  gameModuleVersionId: string | null;
  payload: Record<string, unknown> | null;
  answerKey: Record<string, unknown> | null;
  status: ContentStatusDto;
  testCases: Array<{
    id: string;
    input: string;
    expectedOutput: string;
    weight: number;
    isHidden: boolean;
  }>;
}

export interface MaterialAuthoringDetailDto {
  id: string;
  topicId: string;
  number: number;
  title: string;
  description: string | null;
  learningOutcome: string | null;
  content: string;
  summary: string | null;
  coverAsset: AssetSummaryDto | null;
  status: ContentStatusDto;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  tests: TestAuthoringItemDto[];
}

export interface MutationResultDto {
  success: boolean;
  id: string;
  message?: string;
}

export interface AssetDetailDto extends AssetSummaryDto {
  sha256: string;
  publicUrl: string;
  uploadedBy: string | null;
  createdAt: string;
}


// Metadata tombol hint yang tersedia di halaman Practice (tanpa isi content agar tidak bocor di awal)
export interface HintSummaryDto {
  id: string;
  level: number;
  type: HintTypeDto;
}

// Response saat siswa menekan tombol "Buka Hint Level 1/2/3"
export interface TestHintDetailDto {
  id: string;
  testId: string;
  level: number;
  type: HintTypeDto;
  content: string;
}

// 6. Halaman SMA - Practice Studi Kasus
export interface PracticeCaseStudyItemDto {
  id: string;
  materialId: string;
  number: number;
  title: string;
  questionType: QuestionTypeDto;
  prompt: string;
  points: number;
  difficulty: DifficultyTypeDto;
  bloomLevel: BloomLevelDto;
  maxAttempts: number | null;
  payload: Record<string, unknown> | null;
  sampleTestCases: PublicTestCaseDto[];
  availableHints: HintSummaryDto[];
}

// 7. Halaman SMA - Quiz (Berelasi dengan GameModuleVersion)
export interface QuizGameModuleSummaryDto {
  versionId: string;
  gameModuleId: string;
  moduleSlug: string;
  moduleName: string;
  source: 'template' | 'custom';
  templateId: string | null;
  version: string;
  maxScore: number;
  config: Record<string, unknown>;
}

export interface QuizItemDto {
  id: string;
  materialId: string;
  number: number;
  title: string;
  questionType: QuestionTypeDto;
  prompt: string;
  points: number;
  difficulty: DifficultyTypeDto;
  bloomLevel: BloomLevelDto;
  maxAttempts: number | null;
  gameModuleVersionId: string | null;
  gameModule: QuizGameModuleSummaryDto | null;
  payload: Record<string, unknown> | null;
}

// Katalog Gamifikasi (Challenge & Badge)
export interface BadgeCatalogItemDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  criteria: Record<string, unknown> | null;
  targetValue: number | null;
  iconAsset: AssetSummaryDto | null;
}

export interface ChallengeTierDto {
  id: string;
  tier: 'bronze' | 'silver' | 'gold';
  threshold: number;
  rewardExp: number;
  badge: BadgeCatalogItemDto | null;
}

export interface ChallengeCatalogItemDto {
  id: string;
  code: string;
  type: 'streak' | 'total_exp' | 'test_count' | 'topic_completion';
  educationLevelCode: string | null;
  title: string;
  description: string | null;
  period: string | null;
  gameModuleVersionId: string | null;
  maxScore: number | null;
  isActive: boolean;
  tiers: ChallengeTierDto[];
}
