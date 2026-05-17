import { IsString, IsNumber, IsOptional, Min, Max, Matches } from 'class-validator';

export class CheckUploadDto {
  @Matches(/^[a-f0-9]{64}$/i, { message: 'hash 必须是有效的 SHA-256 哈希值' })
  hash: string;

  @IsString()
  filename: string;

  @IsNumber()
  @Min(1)
  size: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsNumber()
  @Min(1 * 1024 * 1024)   // 最小 1MB
  @Max(50 * 1024 * 1024)  // 最大 50MB
  chunkSize?: number;
}
