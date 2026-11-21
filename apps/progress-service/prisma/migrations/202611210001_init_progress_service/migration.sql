-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "user_badge" (
    "user_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "awarded_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_badge_pkey" PRIMARY KEY ("user_id","badge_id")
);

-- CreateTable
CREATE TABLE "daily_activity" (
    "user_id" UUID NOT NULL,
    "activity_date" DATE NOT NULL,
    "exp_earned" INTEGER NOT NULL,
    "tests_done" INTEGER NOT NULL,
    "logged_in" BOOLEAN NOT NULL,
    "freeze_used" BOOLEAN NOT NULL,

    CONSTRAINT "daily_activity_pkey" PRIMARY KEY ("user_id","activity_date")
);

-- CreateTable
CREATE TABLE "progress_challenge" (
    "user_id" UUID NOT NULL,
    "challenge_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "current_value" INTEGER NOT NULL,
    "best_value" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "progress_challenge_pkey" PRIMARY KEY ("user_id","challenge_id","period_start")
);

-- CreateTable
CREATE TABLE "progress_badge" (
    "user_id" UUID NOT NULL,
    "badge_id" UUID NOT NULL,
    "current_value" INTEGER NOT NULL,
    "target_value" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "progress_badge_pkey" PRIMARY KEY ("user_id","badge_id")
);

-- CreateTable
CREATE TABLE "rank_tier" (
    "id" UUID NOT NULL,
    "name" VARCHAR NOT NULL,
    "min_average_point" DECIMAL(65,30) NOT NULL,
    "max_average_point" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "rank_tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_rank" (
    "user_id" UUID NOT NULL,
    "menu" VARCHAR NOT NULL,
    "average_point" DECIMAL(65,30) NOT NULL,
    "rank_tier_id" UUID NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_rank_pkey" PRIMARY KEY ("user_id","menu")
);

-- CreateTable
CREATE TABLE "exp_transaction" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "exp_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_stat" (
    "user_id" UUID NOT NULL,
    "total_exp" BIGINT NOT NULL,
    "current_streak" INTEGER NOT NULL,
    "longest_streak" INTEGER NOT NULL,
    "last_activity_date" DATE,
    "streak_freeze_count" INTEGER NOT NULL,
    "daily_target" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_stat_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "level" (
    "id" UUID NOT NULL,
    "name" VARCHAR NOT NULL,
    "min_exp" INTEGER NOT NULL,
    "icon_asset_id" UUID NOT NULL,

    CONSTRAINT "level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mastery_rule" (
    "id" UUID NOT NULL,
    "mastery" TEXT NOT NULL,
    "base_exp" INTEGER NOT NULL,
    "exp_bonus" INTEGER NOT NULL,
    "rank_point" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "mastery_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_test" (
    "user_id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "best_score" DECIMAL(65,30) NOT NULL,
    "best_mastery" TEXT NOT NULL,
    "attempts_count" INTEGER NOT NULL,
    "wrong_attempts_count" INTEGER NOT NULL,
    "current_hint_level" SMALLINT NOT NULL,
    "status" TEXT NOT NULL,
    "exp_awarded_at" TIMESTAMPTZ(6),

    CONSTRAINT "progress_test_pkey" PRIMARY KEY ("user_id","test_id")
);

-- CreateTable
CREATE TABLE "submission" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "hints_used" SMALLINT NOT NULL,
    "mastery" TEXT NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "answer" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_code" (
    "id" UUID NOT NULL,
    "source_code" TEXT NOT NULL,
    "compile_status" VARCHAR NOT NULL,
    "execution_status" VARCHAR NOT NULL,
    "execution_time_ms" INTEGER NOT NULL,
    "submission_id" UUID NOT NULL,

    CONSTRAINT "submission_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "ai_score" DECIMAL(65,30) NOT NULL,
    "final_score" DECIMAL(65,30) NOT NULL,
    "ai_suggestion" TEXT NOT NULL,

    CONSTRAINT "score_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rank_tier_name_key" ON "rank_tier"("name");

-- CreateIndex
CREATE INDEX "user_rank_rank_tier_id_idx" ON "user_rank"("rank_tier_id");

-- CreateIndex
CREATE INDEX "exp_transaction_user_id_idx" ON "exp_transaction"("user_id");

-- CreateIndex
CREATE INDEX "exp_transaction_source_type_source_id_idx" ON "exp_transaction"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "level_name_key" ON "level"("name");

-- CreateIndex
CREATE UNIQUE INDEX "level_min_exp_key" ON "level"("min_exp");

-- CreateIndex
CREATE UNIQUE INDEX "mastery_rule_mastery_key" ON "mastery_rule"("mastery");

-- CreateIndex
CREATE INDEX "submission_user_id_idx" ON "submission"("user_id");

-- CreateIndex
CREATE INDEX "submission_test_id_idx" ON "submission"("test_id");

-- CreateIndex
CREATE INDEX "submission_user_id_test_id_idx" ON "submission"("user_id", "test_id");

-- CreateIndex
CREATE UNIQUE INDEX "submission_code_submission_id_key" ON "submission_code"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "score_submission_id_key" ON "score"("submission_id");

-- AddForeignKey
ALTER TABLE "user_rank" ADD CONSTRAINT "user_rank_rank_tier_id_fkey" FOREIGN KEY ("rank_tier_id") REFERENCES "rank_tier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_code" ADD CONSTRAINT "submission_code_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score" ADD CONSTRAINT "score_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

