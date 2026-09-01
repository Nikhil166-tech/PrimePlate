import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import { Category } from '../common/enums/category.enum';
import { ProviderDto } from './dto/provider.dto';
import { MealProvider } from './meal-provider.entity';
import { ProviderImage } from './provider-image.entity';
import { UsersService } from '../users/users.service';
import { UploadsService } from '../uploads/uploads.service';
import { Role } from '../common/roles.enum';
import { ProviderApprovalStatus } from '../common/enums/provider-approval-status.enum';

import {
  Subscription,
  SubscriptionStatus,
} from '../subscriptions/subscription.entity';
import { MealPlan } from '../meal-plans/meal-plan.entity';

@Injectable()
export class ProvidersService {
  constructor(
    @InjectRepository(MealProvider)
    private readonly providerRepo: Repository<MealProvider>,
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    @InjectRepository(ProviderImage)
    private readonly providerImageRepo: Repository<ProviderImage>,
    private readonly usersService: UsersService,
    private readonly uploadsService: UploadsService,
  ) { }

  private normalizeDescription(desc?: string): string | undefined {
    if (desc === undefined || desc === null) return undefined;
    const trimmed = String(desc).trim();
    if (!trimmed) return undefined;
    return trimmed.slice(0, 1000);
  }

  private normalizeAmenities(amenities?: string[]): string[] {
    if (!amenities || !Array.isArray(amenities)) return [];
    const seen = new Set<string>();
    const result: string[] = [];

    for (const raw of amenities) {
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      const lower = trimmed.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(trimmed.slice(0, 50));
      }
      if (result.length >= 30) break;
    }
    return result;
  }

  async create(userId: string, dto: ProviderDto): Promise<MealProvider> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== Role.PROVIDER) {
      throw new ForbiddenException(
        'Only providers can create a provider profile',
      );
    }
    const isProd = process.env.NODE_ENV === 'production';
    const provider = this.providerRepo.create({
      user,
      name: dto.name,
      city: dto.city,
      description: this.normalizeDescription(dto.description),
      address: dto.address,
      imageUrl: dto.imageUrl,
      category: dto.category,
      monthlyPrice: dto.monthlyPrice || 2999,
      totalCapacity: dto.totalCapacity || 50,
      acceptingSubscriptions: dto.acceptingSubscriptions ?? true,
      amenities: this.normalizeAmenities(dto.amenities),
      contactPhone: dto.contactPhone || user.phone || '',
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      approvalStatus: isProd
        ? ProviderApprovalStatus.PENDING
        : ProviderApprovalStatus.APPROVED,
      verified: !isProd,
    } as Partial<MealProvider>);
    const saved = await this.providerRepo.save(provider);

    // Auto-create default meal plan for immediate student checkout
    try {
      const defaultPlan = this.providerRepo.manager.create(MealPlan, {
        title: `${saved.name} Monthly Mess Plan`,
        pricePerMonth: saved.monthlyPrice || 2999,
        description:
          'Standard fresh 3-meal monthly PG/hostel mess subscription',
        provider: saved,
        isActive: true,
      });
      await this.providerRepo.manager.save(MealPlan, defaultPlan);
    } catch (_) {
      // MealPlan creation fallback handled on query
    }

    return saved;
  }

  private async attachCapacityInfo(provider: MealProvider): Promise<any> {
    const currentSubscribers = await this.subRepo
      .createQueryBuilder('sub')
      .innerJoin('sub.mealPlan', 'mp')
      .where('mp.providerId = :pId', { pId: provider.id })
      .andWhere('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
      .getCount();
    const totalCapacity =
      provider.totalCapacity !== undefined && provider.totalCapacity !== null
        ? Number(provider.totalCapacity)
        : null;
    const remainingCapacity =
      totalCapacity !== null
        ? Math.max(0, totalCapacity - currentSubscribers)
        : null;

    // Sanitize user object to never expose passwordHash
    const safeUser = provider.user
      ? {
        id: provider.user.id,
        email: provider.user.email,
        name: provider.user.name,
        role: provider.user.role,
      }
      : undefined;

    const images = this.providerImageRepo
      ? await this.providerImageRepo.find({
        where: { providerId: provider.id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      })
      : [];

    return {
      ...provider,
      user: safeUser,
      totalCapacity,
      currentSubscribers,
      remainingCapacity,
      images,
    };
  }

  async findAll(filters?: { category?: Category }): Promise<any[]> {
    const where: FindOptionsWhere<MealProvider> = {
      approvalStatus: ProviderApprovalStatus.APPROVED,
    };
    if (filters?.category) {
      where.category = filters.category;
    }
    const providers = await this.providerRepo.find({ where });
    return Promise.all(providers.map((p) => this.attachCapacityInfo(p)));
  }

  async findNearby(
    lat: number,
    lng: number,
    radius: number = 5,
  ): Promise<any[]> {
    if (isNaN(lat) || lat < -90 || lat > 90) {
      throw new BadRequestException(
        'Invalid latitude parameter. Must be a number between -90 and 90.',
      );
    }
    if (isNaN(lng) || lng < -180 || lng > 180) {
      throw new BadRequestException(
        'Invalid longitude parameter. Must be a number between -180 and 180.',
      );
    }
    const searchRadius =
      !isNaN(radius) && radius > 0 ? Math.min(radius, 100) : 5;

    // Fetch ONLY APPROVED providers
    const approvedProviders = await this.providerRepo.find({
      where: { approvalStatus: ProviderApprovalStatus.APPROVED },
    });

    const calculateHaversine = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number,
    ): number => {
      const R = 6371; // Earth radius in km
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const nearbyWithDistance: { provider: MealProvider; distanceKm: number }[] =
      [];

    for (const p of approvedProviders) {
      if (
        p.latitude !== null &&
        p.latitude !== undefined &&
        p.longitude !== null &&
        p.longitude !== undefined &&
        !isNaN(Number(p.latitude)) &&
        !isNaN(Number(p.longitude))
      ) {
        const dist = calculateHaversine(
          lat,
          lng,
          Number(p.latitude),
          Number(p.longitude),
        );
        if (dist <= searchRadius) {
          nearbyWithDistance.push({
            provider: p,
            distanceKm: Math.round(dist * 10) / 10,
          });
        }
      }
    }

    // Sort nearest first
    nearbyWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    return Promise.all(
      nearbyWithDistance.map(async (item) => {
        const info = await this.attachCapacityInfo(item.provider);
        return {
          ...info,
          distanceKm: item.distanceKm,
        };
      }),
    );
  }

  async findByUserId(userId: string): Promise<any[]> {
    const providers = await this.providerRepo.find({
      where: { user: { id: userId } },
    });
    return Promise.all(providers.map((p) => this.attachCapacityInfo(p)));
  }

  async findPending(): Promise<MealProvider[]> {
    return this.providerRepo.find({
      where: { approvalStatus: ProviderApprovalStatus.PENDING },
    });
  }

  async findById(id: string): Promise<any> {
    const provider = await this.providerRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    return this.attachCapacityInfo(provider);
  }

  async update(
    userId: string,
    id: string,
    dto: ProviderDto,
  ): Promise<MealProvider> {
    const provider = await this.providerRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.user.id !== userId) {
      throw new ForbiddenException('Cannot edit other providers');
    }

    // Whitelist update fields to prevent mass assignment of approvalStatus or verified
    if (dto.name !== undefined) provider.name = dto.name;
    if (dto.city !== undefined) provider.city = dto.city;
    if (dto.description !== undefined)
      provider.description = this.normalizeDescription(dto.description);
    if (dto.address !== undefined) provider.address = dto.address;
    if (dto.imageUrl !== undefined) provider.imageUrl = dto.imageUrl;
    if (dto.category !== undefined) provider.category = dto.category;
    if (dto.totalCapacity !== undefined)
      provider.totalCapacity = dto.totalCapacity;
    if (dto.acceptingSubscriptions !== undefined)
      provider.acceptingSubscriptions = dto.acceptingSubscriptions;
    if (dto.amenities !== undefined)
      provider.amenities = this.normalizeAmenities(dto.amenities);
    if (dto.contactPhone !== undefined)
      provider.contactPhone = dto.contactPhone;
    if (dto.latitude !== undefined) provider.latitude = dto.latitude;
    if (dto.subscriptionBreaksEnabled !== undefined)
      provider.subscriptionBreaksEnabled = Boolean(
        dto.subscriptionBreaksEnabled,
      );

    if (dto.monthlyPrice !== undefined) {
      const parsedPrice = Number(dto.monthlyPrice);
      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        throw new BadRequestException(
          'Monthly price must be a valid number greater than 0',
        );
      }
      provider.monthlyPrice = parsedPrice;
      const plans = await this.providerRepo.manager.find(MealPlan, {
        where: { provider: { id: provider.id } },
      });
      for (const p of plans) {
        p.pricePerMonth = parsedPrice;
        await this.providerRepo.manager.save(MealPlan, p);
      }
    }

    const saved = await this.providerRepo.save(provider);
    return this.attachCapacityInfo(saved);
  }

  async approve(id: string): Promise<MealProvider> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    provider.approvalStatus = ProviderApprovalStatus.APPROVED;
    provider.verified = true;
    return this.providerRepo.save(provider);
  }

  async reject(id: string): Promise<MealProvider> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    provider.approvalStatus = ProviderApprovalStatus.REJECTED;
    provider.verified = false;
    return this.providerRepo.save(provider);
  }

  async search(filters: {
    name?: string;
    city?: string;
    category?: Category;
  }): Promise<any[]> {
    const where: FindOptionsWhere<MealProvider> = {
      approvalStatus: ProviderApprovalStatus.APPROVED,
    };
    if (filters.name) {
      where.name = ILike(`%${filters.name}%`);
    }
    if (filters.city) {
      where.city = ILike(`%${filters.city}%`);
    }
    if (filters.category) {
      where.category = filters.category;
    }
    const providers = await this.providerRepo.find({ where });
    return Promise.all(providers.map((p) => this.attachCapacityInfo(p)));
  }

  async updateBreakSettings(
    providerId: string,
    userId: string,
    enabled: boolean,
  ): Promise<MealProvider> {
    const provider = await this.providerRepo.findOne({
      where: { id: providerId },
      relations: { user: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.user?.id !== userId && provider.userId !== userId) {
      throw new ForbiddenException(
        'Cannot modify settings for another provider',
      );
    }
    provider.subscriptionBreaksEnabled = enabled;
    return this.providerRepo.save(provider);
  }

  private validateImageBuffer(file: {
    buffer?: Buffer;
    mimetype?: string;
    size?: number;
  }) {
    if (!file || !file.buffer || !Buffer.isBuffer(file.buffer)) {
      throw new BadRequestException('No valid image file provided');
    }

    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size && file.size > maxSize) {
      throw new BadRequestException('File size exceeds maximum 10MB limit');
    }
    if (file.buffer.length > maxSize) {
      throw new BadRequestException('File size exceeds maximum 10MB limit');
    }

    const buf = file.buffer;
    if (buf.length < 12) {
      throw new BadRequestException('Invalid image file format');
    }

    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    const isPng =
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a;
    const isWebp =
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf[8] === 0x57 &&
      buf[9] === 0x45 &&
      buf[10] === 0x42 &&
      buf[11] === 0x50;

    if (!isJpeg && !isPng && !isWebp) {
      throw new BadRequestException(
        'Invalid or unsupported image file. Allowed formats: JPG/JPEG, PNG, WebP',
      );
    }
  }

  async uploadImage(
    userId: string,
    file: any,
    providerId?: string,
    imageCategory?: string,
  ): Promise<ProviderImage> {
    this.validateImageBuffer(file);

    let provider: MealProvider | null = null;
    if (providerId) {
      provider = await this.providerRepo.findOne({
        where: { id: providerId },
        relations: { user: true },
      });
      if (!provider) throw new NotFoundException('Provider not found');
      if (provider.userId !== userId && provider.user?.id !== userId) {
        throw new ForbiddenException(
          'Cannot upload images for another provider',
        );
      }
    } else {
      provider = await this.providerRepo.findOne({
        where: [{ userId }, { user: { id: userId } }],
        relations: { user: true },
      });
      if (!provider) throw new NotFoundException('Provider profile not found');
    }

    const currentCount = await this.providerImageRepo.count({
      where: { providerId: provider.id },
    });
    if (currentCount >= 10) {
      throw new BadRequestException(
        'Maximum limit of 10 hostel images reached for this provider',
      );
    }

    const uploadResult = await this.uploadsService.upload(
      file,
      'primeplate/hostels',
    );
    const newImage = this.providerImageRepo.create({
      providerId: provider.id,
      imageUrl: uploadResult.secure_url,
      originalFileName: file.originalname || file.name || 'hostel_image.jpg',
      imageType: file.mimetype || 'image/jpeg',
      imageCategory: (imageCategory && imageCategory.trim()) ? imageCategory.trim() : 'Other',
      sortOrder: currentCount,
    });

    return this.providerImageRepo.save(newImage);
  }

  async replaceImage(
    userId: string,
    imageId: string,
    file: any,
    imageCategory?: string,
  ): Promise<ProviderImage> {
    this.validateImageBuffer(file);

    const image = await this.providerImageRepo.findOne({
      where: { id: imageId },
      relations: { provider: { user: true } },
    });
    if (!image) {
      throw new NotFoundException('Hostel image not found');
    }

    if (
      image.provider &&
      image.provider.userId !== userId &&
      image.provider.user?.id !== userId
    ) {
      throw new ForbiddenException(
        'Cannot replace image belonging to another provider',
      );
    }

    const uploadResult = await this.uploadsService.upload(
      file,
      'primeplate/hostels',
    );

    image.imageUrl = uploadResult.secure_url;
    image.originalFileName = file.originalname || file.name || image.originalFileName;
    image.imageType = file.mimetype || image.imageType || 'image/jpeg';
    if (imageCategory && imageCategory.trim()) {
      image.imageCategory = imageCategory.trim();
    }

    return this.providerImageRepo.save(image);
  }

  async getProviderImages(providerId: string): Promise<ProviderImage[]> {
    return this.providerImageRepo.find({
      where: { providerId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async getMyImages(
    userId: string,
    providerId?: string,
  ): Promise<ProviderImage[]> {
    let targetProviderId = providerId;
    if (!targetProviderId) {
      const provider = await this.providerRepo.findOne({
        where: [{ userId }, { user: { id: userId } }],
      });
      if (!provider) return [];
      targetProviderId = provider.id;
    } else {
      const provider = await this.providerRepo.findOne({
        where: { id: targetProviderId },
        relations: { user: true },
      });
      if (!provider) throw new NotFoundException('Provider not found');
      if (provider.userId !== userId && provider.user?.id !== userId) {
        throw new ForbiddenException(
          'Cannot access images for another provider',
        );
      }
    }

    return this.getProviderImages(targetProviderId);
  }

  async deleteImage(
    userId: string,
    imageId: string,
  ): Promise<{ success: boolean; message: string }> {
    const image = await this.providerImageRepo.findOne({
      where: { id: imageId },
      relations: { provider: { user: true } },
    });
    if (!image) {
      throw new NotFoundException('Hostel image not found');
    }

    if (
      image.provider &&
      image.provider.userId !== userId &&
      image.provider.user?.id !== userId
    ) {
      throw new ForbiddenException(
        'Cannot delete images from another provider',
      );
    }

    await this.providerImageRepo.remove(image);
    return { success: true, message: 'Hostel image deleted successfully' };
  }
}
