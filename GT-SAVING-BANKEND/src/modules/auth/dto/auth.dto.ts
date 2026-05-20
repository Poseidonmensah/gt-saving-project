import { IsString, MinLength, IsOptional, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty() @IsString() username!: string;
  @ApiProperty() @IsString() @MinLength(8) password!: string;
  @IsOptional() @IsString() @Length(6, 6) mfaToken?: string;
}

export class MfaVerifyDto {
  @ApiProperty() @IsString() @Length(6, 6) token!: string;
}

export class ChangePasswordDto {
  @ApiProperty() @IsString() currentPassword!: string;
  @ApiProperty() @IsString() @MinLength(8) newPassword!: string;
}