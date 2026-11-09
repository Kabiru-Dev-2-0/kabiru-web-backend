import { Injectable } from '@nestjs/common';
import { createHash, createHmac } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface PutObjectResult {
  storagePath: string;
  publicUrl: string;
  sizeBytes: number;
  sha256: string;
}

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

function encodeS3Key(key: string): string {
  return key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

@Injectable()
export class R2StorageService {
  private readonly accountId = process.env.R2_ACCOUNT_ID?.trim() ?? '';
  private readonly accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim() ?? '';
  private readonly secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim() ?? '';
  private readonly bucketName = process.env.R2_BUCKET_NAME?.trim() || 'kabiru-assets';
  private readonly publicBaseUrl = (
    process.env.R2_PUBLIC_BASE_URL?.trim() || 'http://localhost:3000/assets'
  ).replace(/\/+$/, '');
  private readonly localFallbackRoot = resolve(process.cwd(), '.local-r2-storage');

  isR2Configured(): boolean {
    return Boolean(this.accountId && this.accessKeyId && this.secretAccessKey && this.bucketName);
  }

  getPublicUrl(key: string): string {
    const cleanKey = key.replace(/^\/+/, '');
    return `${this.publicBaseUrl}/${cleanKey}`;
  }

  getBasePublicUrl(prefix: string): string {
    const cleanPrefix = prefix.replace(/^\/+|\/+$/g, '');
    return `${this.publicBaseUrl}/${cleanPrefix}/`;
  }

  async putObject(input: PutObjectInput): Promise<PutObjectResult> {
    const cleanKey = input.key.replace(/^\/+/, '');
    const sha256 = sha256Hex(input.body);
    const sizeBytes = input.body.byteLength;

    // Selalu simpan salinan lokal di .local-r2-storage agar pembacaan entrypoint / offline dev cepat & tahan gangguan
    const localFilePath = join(this.localFallbackRoot, cleanKey);
    await mkdir(dirname(localFilePath), { recursive: true });
    await writeFile(localFilePath, input.body);

    if (this.isR2Configured()) {
      await this.uploadToCloudflareR2({
        key: cleanKey,
        body: input.body,
        contentType: input.contentType,
        payloadHash: sha256,
      });
    }

    return {
      storagePath: cleanKey,
      publicUrl: this.getPublicUrl(cleanKey),
      sizeBytes,
      sha256,
    };
  }

  async getObjectText(key: string): Promise<string | null> {
    const cleanKey = key.replace(/^\/+/, '');
    const localFilePath = join(this.localFallbackRoot, cleanKey);

    try {
      const buf = await readFile(localFilePath);
      return buf.toString('utf8');
    } catch {
      // Jika tidak ada di cache lokal dan R2 aktif, ambil dari R2
      if (this.isR2Configured()) {
        return this.downloadTextFromCloudflareR2(cleanKey);
      }
      return null;
    }
  }

  private async uploadToCloudflareR2(params: {
    key: string;
    body: Buffer;
    contentType: string;
    payloadHash: string;
  }): Promise<void> {
    const host = `${this.accountId}.r2.cloudflarestorage.com`;
    const canonicalUri = `/${encodeURIComponent(this.bucketName)}/${encodeS3Key(params.key)}`;
    const endpoint = `https://${host}${canonicalUri}`;

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const region = 'auto';
    const service = 's3';

    const canonicalHeaders =
      `content-type:${params.contentType}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${params.payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      params.payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest),
    ].join('\n');

    const kDate = hmacSha256(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = hmacSha256(kDate, region);
    const kService = hmacSha256(kRegion, service);
    const kSigning = hmacSha256(kService, 'aws4_request');
    const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');

    const authorization =
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const response = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'content-type': params.contentType,
        'x-amz-content-sha256': params.payloadHash,
        'x-amz-date': amzDate,
        Authorization: authorization,
      },
      body: new Uint8Array(params.body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Cloudflare R2 upload gagal (${response.status}): ${errorText}`);
    }
  }

  private async downloadTextFromCloudflareR2(key: string): Promise<string | null> {
    const publicUrl = this.getPublicUrl(key);
    try {
      const response = await fetch(publicUrl);
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  }
}
