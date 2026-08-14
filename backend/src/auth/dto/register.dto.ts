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

  @IsNotEmpty({ message: 'Password is required' })
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~`]).{8,}$/,
    {
      message:
        'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    },
  )
  password: string;

  @IsOptional()
  @IsEnum([Role.STUDENT, Role.PROVIDER], {
    message: 'Public registration role must be either STUDENT or PROVIDER',
  })
  @NotEquals(Role.ADMIN, { message: 'Admin registration is not allowed publicly' })
  role?: Role;
}
