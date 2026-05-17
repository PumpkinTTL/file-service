import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CheckUploadDto {
  @IsString()
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
