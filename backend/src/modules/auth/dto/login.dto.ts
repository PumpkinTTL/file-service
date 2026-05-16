import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString({ message: '用户名必须是字符串' })
  username: string;

  @IsString({ message: '密码必须是字符串' })
  @MinLength(6, { message: '密码长度不能少于6位' })
  password: string;
}
