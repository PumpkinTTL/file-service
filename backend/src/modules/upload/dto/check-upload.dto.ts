import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CheckUploadDto {
  @IsString()
  hash: string;

  @IsString()
  filename: string;

  @IsNumber()
  size: number;

  @IsOptional()
  @IsString()
  mimeType?: string;
}
