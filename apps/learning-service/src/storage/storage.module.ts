import { Global, Module } from '@nestjs/common';
import { AssetController } from './asset.controller';
import { AssetService } from './asset.service';
import { R2StorageService } from './r2-storage.service';

@Global()
@Module({
  controllers: [AssetController],
  providers: [R2StorageService, AssetService],
  exports: [R2StorageService, AssetService],
})
export class StorageModule {}
