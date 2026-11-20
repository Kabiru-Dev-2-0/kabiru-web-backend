-- CreateTable
CREATE TABLE "learning_session" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ,

    CONSTRAINT "learning_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hint_request" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "test_id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "wrong_attempts_count_snapshot" INTEGER NOT NULL DEFAULT 0,
    "hint_level" SMALLINT NOT NULL,
    "student_response" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error_context" JSONB,

    CONSTRAINT "hint_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hint_output" (
    "id" UUID NOT NULL,
    "hint_request_id" UUID NOT NULL,
    "generated_hint" TEXT NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hint_output_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_interaction" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "material_id" UUID,
    "test_id" UUID,
    "student_message" TEXT NOT NULL,
    "agent_response" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "session_id" UUID NOT NULL,

    CONSTRAINT "ai_interaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emotion_classification" (
    "id" UUID NOT NULL,
    "emotion_label" VARCHAR(100) NOT NULL,
    "confidence_score" DECIMAL(5,4) NOT NULL,
    "interaction_id" UUID NOT NULL,
    "threshold_status" BOOLEAN NOT NULL,
    "model_name" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emotion_classification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_animation" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "emotion_label" VARCHAR(100) NOT NULL,
    "asset_id" UUID NOT NULL,

    CONSTRAINT "agent_animation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emotion_feedback" (
    "id" UUID NOT NULL,
    "classification_id" UUID NOT NULL,
    "feedback_text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "animation_id" UUID NOT NULL,

    CONSTRAINT "emotion_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hint_output_hint_request_id_key" ON "hint_output"("hint_request_id");

-- CreateIndex
CREATE UNIQUE INDEX "emotion_classification_interaction_id_key" ON "emotion_classification"("interaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_animation_code_key" ON "agent_animation"("code");

-- AddForeignKey
ALTER TABLE "hint_request" ADD CONSTRAINT "hint_request_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hint_output" ADD CONSTRAINT "hint_output_hint_request_id_fkey" FOREIGN KEY ("hint_request_id") REFERENCES "hint_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_interaction" ADD CONSTRAINT "ai_interaction_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "learning_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emotion_classification" ADD CONSTRAINT "emotion_classification_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "ai_interaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emotion_feedback" ADD CONSTRAINT "emotion_feedback_classification_id_fkey" FOREIGN KEY ("classification_id") REFERENCES "emotion_classification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emotion_feedback" ADD CONSTRAINT "emotion_feedback_animation_id_fkey" FOREIGN KEY ("animation_id") REFERENCES "agent_animation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
