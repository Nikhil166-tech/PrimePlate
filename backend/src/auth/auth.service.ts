import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshToken } from './refresh-token.entity';
import { User } from '../users/user.entity';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { JwtPayload } from './types/jwt-payload.type';
import { Role } from '../common/roles.enum';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async generateAndSaveTokenPair(user: User) {
    const payload: JwtPayload = { userId: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1d' });
    const rawRefreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const refreshTokenEntity = this.refreshTokenRepo.create({
      user,
      tokenHash,
      expiresAt,
      revoked: false,
    });
    await this.refreshTokenRepo.save(refreshTokenEntity);

    return {
      user: { id: user.id, email: user.email, role: user.role, name: user.name, phone: user.phone },
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('User with this email already exists');
    }

    let role = Role.STUDENT;
    if (dto.role) {
      const normalized = String(dto.role).toUpperCase();
      if (normalized === 'ADMIN') {
        throw new ForbiddenException(
          'Public Admin account registration is strictly forbidden',
        );
      } else if (normalized === 'PROVIDER' || normalized === 'MEAL_PROVIDER') {
        role = Role.PROVIDER;
      }
    }

    const trimmedName = dto.name ? dto.name.trim() : undefined;
    const trimmedPhone = dto.phone ? dto.phone.trim() : undefined;

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash: hashed,
      name: trimmedName,
      phone: trimmedPhone,
      role,
    });

    return this.generateAndSaveTokenPair(user);
  }

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new BadRequestException('Invalid email or password');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new BadRequestException('Invalid email or password');

    return this.generateAndSaveTokenPair(user);
  }

  async refreshToken(rawRefreshToken: string) {
    if (!rawRefreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(rawRefreshToken);
    } catch (_) {
      throw new UnauthorizedException('Invalid or expired refresh token signature');
    }

    const tokenHash = this.hashToken(rawRefreshToken);
    const tokenEntity = await this.refreshTokenRepo.findOne({
      where: { tokenHash, revoked: false },
      relations: { user: true },
    });

    if (!tokenEntity || tokenEntity.revoked || new Date() > tokenEntity.expiresAt) {
      throw new UnauthorizedException(
        'Refresh token has expired, been revoked, or already reused',
      );
    }

    // Token Rotation: Revoke used token
    tokenEntity.revoked = true;
    await this.refreshTokenRepo.save(tokenEntity);

    // Issue fresh pair
    return this.generateAndSaveTokenPair(tokenEntity.user);
  }

  async logout(userId: string) {
    if (userId) {
      await this.refreshTokenRepo.update(
        { user: { id: userId }, revoked: false },
        { revoked: true },
      );
    }
    return { message: 'Logged out successfully' };
  }
}
