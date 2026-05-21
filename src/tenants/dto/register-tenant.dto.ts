import {
  IsNotEmpty,
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterTenantDto {
  @ApiProperty({ example: 'Al-Shifa Pharmacy' })
  @IsString()
  @IsNotEmpty()
  business_name: string;

  @ApiProperty({ example: 'al-shifa-01' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-z0-9-]+$/, {
    message:
      'tenant_slug must contain only lowercase letters, numbers, and hyphens',
  })
  tenant_slug: string;

  @ApiProperty({ example: 'Dr. Eslam Fathi' })
  @IsString()
  @IsNotEmpty()
  owner_name: string;

  @ApiProperty({ example: 'eslam_owner' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  username: string;

  @ApiProperty({ example: 'Password123!' })
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

  @ApiProperty({ example: '+966500000000', required: false })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiProperty({ example: 'admin@alshifa.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;
}
