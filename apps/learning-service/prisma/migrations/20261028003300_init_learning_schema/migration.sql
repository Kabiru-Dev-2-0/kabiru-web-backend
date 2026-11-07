-- CreateEnum
CREATE TYPE "content_status" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "visibility_type" AS ENUM ('public', 'class_only');

-- CreateEnum
CREATE TYPE "module_status" AS ENUM ('draft', 'active', 'disabled');

-- CreateEnum
CREATE TYPE "asset_kind" AS ENUM ('image', 'audio', 'script', 'bundle', 'document');

-- CreateEnum
CREATE TYPE "difficulty_type" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "bloom_level" AS ENUM ('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create');

-- CreateEnum
CREATE TYPE "hint_type" AS ENUM ('pseudocode', 'cloze_code', 'full_code');

-- CreateEnum
CREATE TYPE "challenge_type" AS ENUM ('streak', 'total_exp', 'test_count', 'topic_completion');

-- CreateEnum
CREATE TYPE "tier_type" AS ENUM ('bronze', 'silver', 'gold');

-- CreateTable
CREATE TABLE "education_level" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "education_level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject" (
    "id" UUID NOT NULL,
    "education_level_id" UUID NOT NULL,
    "name" VARCHAR(150) NOT NULL,

    CONSTRAINT "subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic" (
    "id" UUID NOT NULL,
    "subject_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "cover_asset_id" UUID,
    "visibility" "visibility_type" NOT NULL DEFAULT 'public',
    "status" "content_status" NOT NULL DEFAULT 'draft',
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "learning_outcome" TEXT,
    "content" TEXT NOT NULL,
    "summary" TEXT,
    "cover_asset_id" UUID,
    "status" "content_status" NOT NULL DEFAULT 'draft',
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset" (
    "id" UUID NOT NULL,
    "kind" "asset_kind" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "uploaded_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_type" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "config_schema" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "template_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_module" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "kind" VARCHAR(50) NOT NULL DEFAULT 'template',
    "template_type_id" UUID,
    "status" "module_status" NOT NULL DEFAULT 'draft',
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_module_version" (
    "id" UUID NOT NULL,
    "game_module_id" UUID NOT NULL,
    "version" VARCHAR(50) NOT NULL,
    "checksum_sha256" CHAR(64),
    "config_schema" JSONB,
    "sandbox_policy" JSONB,
    "manifest" JSONB,
    "config" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_module_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_module_file" (
    "id" UUID NOT NULL,
    "game_module_version_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "relative_path" TEXT NOT NULL,
    "is_entrypoint" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_module_file_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test" (
    "id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "game_module_version_id" UUID,
    "rubric_id" UUID,
    "created_by" UUID,
    "number" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "question_type" VARCHAR(50) NOT NULL,
    "prompt" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 10,
    "difficulty" "difficulty_type" NOT NULL DEFAULT 'medium',
    "bloom_level" "bloom_level" NOT NULL DEFAULT 'remember',
    "max_attempts" INTEGER,
    "payload" JSONB,
    "answer_key" JSONB,
    "status" "content_status" NOT NULL DEFAULT 'draft',
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "test_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hint" (
    "id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "level" SMALLINT NOT NULL,
    "type" "hint_type" NOT NULL,
    "content" TEXT NOT NULL,

    CONSTRAINT "hint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_case" (
    "id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "input" TEXT NOT NULL,
    "expected_output" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "test_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rubric" (
    "id" UUID NOT NULL,
    "title" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "prompt" TEXT,
    "max_score" INTEGER NOT NULL,

    CONSTRAINT "rubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "type" "challenge_type" NOT NULL,
    "education_level_id" UUID,
    "menu" VARCHAR(50),
    "period" VARCHAR(50),
    "rule" JSONB,
    "payload" JSONB,
    "game_module_version_id" UUID,
    "max_score" INTEGER,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "starts_at" TIMESTAMPTZ,
    "ends_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_tier" (
    "id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "tier" "tier_type" NOT NULL,
    "threshold" INTEGER NOT NULL,
    "reward_exp" INTEGER NOT NULL,
    "badge_id" UUID,

    CONSTRAINT "challenge_tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "badge" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "criteria" JSONB,
    "target_value" INTEGER,
    "icon_asset_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "badge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "education_level_code_key" ON "education_level"("code");

-- CreateIndex
CREATE UNIQUE INDEX "asset_sha256_key" ON "asset"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "template_type_code_key" ON "template_type"("code");

-- CreateIndex
CREATE UNIQUE INDEX "game_module_key_key" ON "game_module"("key");

-- CreateIndex
CREATE UNIQUE INDEX "game_module_version_game_module_id_version_key" ON "game_module_version"("game_module_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "game_module_file_game_module_version_id_relative_path_key" ON "game_module_file"("game_module_version_id", "relative_path");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_code_key" ON "challenge"("code");

-- CreateIndex
CREATE UNIQUE INDEX "badge_code_key" ON "badge"("code");

-- AddForeignKey
ALTER TABLE "subject" ADD CONSTRAINT "subject_education_level_id_fkey" FOREIGN KEY ("education_level_id") REFERENCES "education_level"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic" ADD CONSTRAINT "topic_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "topic" ADD CONSTRAINT "topic_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material" ADD CONSTRAINT "material_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material" ADD CONSTRAINT "material_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_module" ADD CONSTRAINT "game_module_template_type_id_fkey" FOREIGN KEY ("template_type_id") REFERENCES "template_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_module_version" ADD CONSTRAINT "game_module_version_game_module_id_fkey" FOREIGN KEY ("game_module_id") REFERENCES "game_module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_module_file" ADD CONSTRAINT "game_module_file_game_module_version_id_fkey" FOREIGN KEY ("game_module_version_id") REFERENCES "game_module_version"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_module_file" ADD CONSTRAINT "game_module_file_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test" ADD CONSTRAINT "test_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test" ADD CONSTRAINT "test_game_module_version_id_fkey" FOREIGN KEY ("game_module_version_id") REFERENCES "game_module_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test" ADD CONSTRAINT "test_rubric_id_fkey" FOREIGN KEY ("rubric_id") REFERENCES "rubric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hint" ADD CONSTRAINT "hint_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "test_case" ADD CONSTRAINT "test_case_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "test"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_education_level_id_fkey" FOREIGN KEY ("education_level_id") REFERENCES "education_level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_game_module_version_id_fkey" FOREIGN KEY ("game_module_version_id") REFERENCES "game_module_version"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_tier" ADD CONSTRAINT "challenge_tier_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_tier" ADD CONSTRAINT "challenge_tier_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "badge"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "badge" ADD CONSTRAINT "badge_icon_asset_id_fkey" FOREIGN KEY ("icon_asset_id") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
