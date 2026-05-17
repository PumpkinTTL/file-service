import { IsString, IsNumber } from 'class-validator';

export class MergeChunksDto {
  @IsString()
  uploadId: string;

  @IsString()
  filename: string;

  @IsString()
  hash: string;

  @IsNumber()
  totalChunks: number;
}
