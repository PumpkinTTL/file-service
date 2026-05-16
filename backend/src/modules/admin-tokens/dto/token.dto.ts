import { IsString, IsOptional } from 'class-validator';

export class CreateTokenDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class UpdateTokenDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
