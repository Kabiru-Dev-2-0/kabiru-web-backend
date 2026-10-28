import type { EducationLevelCode } from '../common/envelope';

export type ContentStatusDto = 'draft' | 'published' | 'archived';
export type DifficultyTypeDto = 'easy' | 'medium' | 'hard';
export type BloomLevelDto = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
export type AssetKindDto = 'image' | 'audio' | 'script' | 'bundle' | 'document';
export type QuestionTypeDto =
  | 'multiple_choice'
  | 'fill_blank'
  | 'drag_drop'
  | 'sorting'
  | 'true_false'
  | 'multi_select'
  | 'pattern_painter'
  | 'maze_runner';

export interface AssetSummaryDto {
  id: string;
  kind: AssetKindDto;
  storagePath: string;
  mimeType: string;
  sizeBytes: number;
}

export interface MaterialCardDto {
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

export interface TopicWithMaterialsDto {
  id: string;
  subjectId: string;
  number: number;
  title: string;
  description: string | null;
  coverAsset: AssetSummaryDto | null;
  status: ContentStatusDto;
  materials: MaterialCardDto[];
}

export interface CurriculumSubjectTreeDto {
  educationLevel: {
    id: string;
    code: EducationLevelCode;
    name: string;
  };
  subjects: Array<{
    id: string;
    name: string;
    topics: TopicWithMaterialsDto[];
  }>;
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