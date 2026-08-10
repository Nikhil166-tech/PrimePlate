import { IsEmail, IsNotEmpty, MinLength, IsOptional, IsEnum, NotEquals } from 'class-validator';
import { Role } from '../../common/roles.enum';

export class RegisterDto {
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
