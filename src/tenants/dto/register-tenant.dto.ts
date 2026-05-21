import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterTenantDto {
  @IsString()
  @IsNotEmpty()
  business_name: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'tenant_slug must contain only lowercase letters, numbers, and hyphens',
  })
  tenant_slug: string;

  @IsString()
  @IsNotEmpty()
  owner_name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username: string;

  @IsString()
  @IsNotEmpty()
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
    {
      message:
        'Password must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters.',
    },
  )
  password: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEmail()
  @IsOptional()
  email?: string;
}
