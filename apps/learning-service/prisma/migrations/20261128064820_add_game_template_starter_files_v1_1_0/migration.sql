-- AlterTable
ALTER TABLE "game_template" ADD COLUMN     "preview_asset_id" UUID,
ADD COLUMN     "starter_files" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
