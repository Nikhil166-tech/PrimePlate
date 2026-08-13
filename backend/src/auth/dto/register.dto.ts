import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsEnum, NotEquals, IsString, MaxLength, Matches } from 'class-validator';
import { Role } from '../../common/roles.enum';

export class RegisterDto {
  @IsNotEmpty({ message: 'Full name is required' })
  @IsString({ message: 'Full name must be a string' })
  @MaxLength(100, { message: 'Full name cannot exceed 100 characters' })
  name: string;

  @IsNotEmpty({ message: 'Phone number is required' })
  @IsString({ message: 'Phone number must be a string' })
  @Matches(/^[0-9+\s\-()]{8,20}$/, { message: 'Please provide a valid phone number' })
  phone: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @IsNotEmpty()
  @MinLength(4, { message: 'Password must be at least 4 characters long' })
  password: string;

  @IsOptional()
  @IsEnum([Role.STUDENT, Role.PROVIDER], {
    message: 'Public registration role must be either STUDENT or PROVIDER',
  })
  @NotEquals(Role.ADMIN, { message: 'Admin registration is not allowed publicly' })
  role?: Role;
}
