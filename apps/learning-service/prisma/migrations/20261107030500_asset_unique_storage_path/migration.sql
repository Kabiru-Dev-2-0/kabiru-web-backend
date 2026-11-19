-- DropIndex
DROP INDEX "asset_sha256_key";

-- CreateIndex
CREATE INDEX "asset_sha256_idx" ON "asset"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "asset_storage_path_key" ON "asset"("storage_path");
