/*
  Warnings:

  - You are about to drop the column `key` on the `game_module` table. All the data in the column will be lost.
  - You are about to drop the column `kind` on the `game_module` table. All the data in the column will be lost.
  - You are about to drop the column `template_type_id` on the `game_module` table. All the data in the column will be lost.
  - You are about to drop the column `config_schema` on the `game_module_version` table. All the data in the column will be lost.
  - You are about to drop the column `created_by` on the `game_module_version` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `game_module_version` table. All the data in the column will be lost.
  - You are about to drop the column `sandbox_policy` on the `game_module_version` table. All the data in the column will be lost.
  - You are about to drop the `template_type` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[slug]` on the table `game_module` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `game_module` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `game_module` table without a default value. This is not possible if the table is not empty.
  - Made the column `created_by` on table `game_module` required. This step will fail if there are existing NULL values in that column.
  - Made the column `config` on table `game_module_version` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "module_source" AS ENUM ('template', 'custom');

-- CreateEnum
CREATE TYPE "version_status" AS ENUM ('draft', 'published', 'archived');

-- DropForeignKey
ALTER TABLE "game_module" DROP CONSTRAINT "game_module_template_type_id_fkey";

-- DropIndex
DROP INDEX "game_module_key_key";

-- AlterTable
ALTER TABLE "game_module" DROP COLUMN "key",
DROP COLUMN "kind",
DROP COLUMN "template_type_id",
ADD COLUMN     "deleted_at" TIMESTAMPTZ,
ADD COLUMN     "slug" VARCHAR(100) NOT NULL,
ADD COLUMN     "source" "module_source" NOT NULL DEFAULT 'template',
ADD COLUMN     "template_id" TEXT,
ADD COLUMN     "updated_at" TIMESTAMPTZ NOT NULL,
ALTER COLUMN "created_by" SET NOT NULL;

-- AlterTable
ALTER TABLE "game_module_version" DROP COLUMN "config_schema",
DROP COLUMN "created_by",
DROP COLUMN "is_active",
DROP COLUMN "sandbox_policy",
ADD COLUMN     "published_at" TIMESTAMPTZ,
ADD COLUMN     "published_by" UUID,
ADD COLUMN     "status" "version_status" NOT NULL DEFAULT 'draft',
ADD COLUMN     "storage_prefix" TEXT,
ALTER COLUMN "config" SET NOT NULL,
ALTER COLUMN "config" SET DEFAULT '{}';

-- DropTable
DROP TABLE "template_type";

-- CreateTable
CREATE TABLE "game_template" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "config_schema" JSONB NOT NULL,
    "default_config" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "game_module_slug_key" ON "game_module"("slug");

-- AddForeignKey
ALTER TABLE "game_module" ADD CONSTRAINT "game_module_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "game_template"("id") ON DELETE SET NULL ON UPDATE CASCADE;
