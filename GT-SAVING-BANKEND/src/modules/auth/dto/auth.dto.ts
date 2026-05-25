import { IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty() @IsString() username!: string;
  @ApiProperty() @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() mfaToken?: string;
}

export class MfaVerifyDto {
  @IsString() token!: string;
}

export class ChangePasswordDto {
  @IsString() currentPassword!: string;
  @IsString() @MinLength(8) newPassword!: string;
}