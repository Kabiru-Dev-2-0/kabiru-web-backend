import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  AssetIdParamSchema,
  LEARNING_PATTERNS,
  UploadAssetSchema,
  type AssetDetailDto,
} from '@kabiru/contracts';
import { extractActor, validateRpcData } from '../common/rpc-validation.util';
import { AssetService } from './asset.service';

@Controller()
export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  @MessagePattern(LEARNING_PATTERNS.ASSET_UPLOAD)
  uploadAsset(@Payload() payload: unknown): Promise<AssetDetailDto> {
    const data = validateRpcData(UploadAssetSchema, payload);
    const actor = extractActor(payload);
    return this.assetService.uploadLmsAsset(data, actor);
  }

  @MessagePattern(LEARNING_PATTERNS.ASSET_GET_DETAIL)
  getAssetDetail(@Payload() payload: unknown): Promise<AssetDetailDto> {
    const params = validateRpcData(AssetIdParamSchema, payload);
    return this.assetService.getAssetDetail(params);
  }
}
