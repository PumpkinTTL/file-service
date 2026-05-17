import { IsString, IsNumber, Matches, Min } from 'class-validator';

export class MergeChunksDto {
  @IsString()
  uploadId: string;

  @IsString()
  filename: string;

  @Matches(/^[a-f0-9]{64}$/i, { message: 'hash 必须是有效的 SHA-256 哈希值' })
  hash: string;

  @IsNumber()
  @Min(1)
  totalChunks: number;
}
