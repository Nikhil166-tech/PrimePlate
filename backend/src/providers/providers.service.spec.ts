import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProvidersService } from './providers.service';
import { MealProvider } from './meal-provider.entity';
import { ProviderImage } from './provider-image.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { UsersService } from '../users/users.service';
import { UploadsService } from '../uploads/uploads.service';
import { Role } from '../common/roles.enum';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('ProvidersService — Description, Amenities & Hostel Images Specification', () => {
  let service: ProvidersService;
  let providerRepo: any;
  let providerImageRepo: any;
  let usersService: any;
  let uploadsService: any;
  let subRepo: any;

  const mockUserProviderA = {
    id: 'user-prov-a',
    name: 'Nikhil Provider',
    email: 'nikhil@pg.com',
    phone: '+91 9876543210',
    role: Role.PROVIDER,
  };

  const mockUserProviderB = {
    id: 'user-prov-b',
    name: 'Other Provider',
    email: 'other@pg.com',
    phone: '+91 9876543211',
    role: Role.PROVIDER,
  };

  const savedProviders: any[] = [];
  const savedImages: any[] = [];

  beforeEach(async () => {
    savedProviders.length = 0;
    savedImages.length = 0;

    providerRepo = {
      create: jest.fn((dto) => ({ id: 'prov-' + Math.random().toString(36).substr(2, 5), ...dto })),
      save: jest.fn(async (entity) => {
        const idx = savedProviders.findIndex((p) => p.id === entity.id);
        if (idx >= 0) {
          savedProviders[idx] = { ...savedProviders[idx], ...entity };
          return savedProviders[idx];
        }
        savedProviders.push(entity);
        return entity;
      }),
      findOne: jest.fn(async (opts) => {
        if (opts.where) {
          if (Array.isArray(opts.where)) {
            for (const w of opts.where) {
              const f = savedProviders.find(
                (p) =>
                  p.id === w.id ||
                  p.userId === w.userId ||
                  p.user?.id === w.userId ||
                  p.user?.id === w.user?.id,
              );
              if (f) return { ...f };
            }
            return null;
          }
          const found = savedProviders.find(
            (p) =>
              p.id === opts.where.id ||
              p.userId === opts.where.userId ||
              p.user?.id === opts.where.userId ||
              p.user?.id === opts.where.user?.id,
          );
          return found ? { ...found } : null;
        }
        return null;
      }),
      find: jest.fn(async () => [...savedProviders]),
      manager: {
        create: jest.fn((_, plan) => plan),
        save: jest.fn(async (_, plan) => plan),
        find: jest.fn(async () => []),
      },
    };

    providerImageRepo = {
      create: jest.fn((dto) => ({ id: 'img-' + Math.random().toString(36).substr(2, 5), ...dto })),
      save: jest.fn(async (entity) => {
        const idx = savedImages.findIndex((i) => i.id === entity.id);
        if (idx >= 0) {
          savedImages[idx] = { ...savedImages[idx], ...entity };
          return savedImages[idx];
        }
        savedImages.push(entity);
        return entity;
      }),
      count: jest.fn(async ({ where }) => {
        return savedImages.filter((i) => i.providerId === where.providerId).length;
      }),
      find: jest.fn(async ({ where }) => {
        return savedImages.filter((i) => i.providerId === where.providerId);
      }),
      findOne: jest.fn(async ({ where }) => {
        const found = savedImages.find((i) => i.id === where.id);
        if (!found) return null;
        const prov = savedProviders.find((p) => p.id === found.providerId);
        return { ...found, provider: prov };
      }),
      remove: jest.fn(async (entity) => {
        const idx = savedImages.findIndex((i) => i.id === entity.id);
        if (idx >= 0) savedImages.splice(idx, 1);
        return entity;
      }),
    };

    uploadsService = {
      upload: jest.fn(async (file) => ({
        secure_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      })),
    };

    subRepo = {
      createQueryBuilder: jest.fn(() => ({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(5),
      })),
    };

    usersService = {
      findById: jest.fn(async (id) => {
        if (id === mockUserProviderA.id) return mockUserProviderA;
        if (id === mockUserProviderB.id) return mockUserProviderB;
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvidersService,
        {
          provide: getRepositoryToken(MealProvider),
          useValue: providerRepo,
        },
        {
          provide: getRepositoryToken(ProviderImage),
          useValue: providerImageRepo,
        },
        {
          provide: getRepositoryToken(Subscription),
          useValue: subRepo,
        },
        {
          provide: UsersService,
          useValue: usersService,
        },
        {
          provide: UploadsService,
          useValue: uploadsService,
        },
      ],
    }).compile();

    service = module.get<ProvidersService>(ProvidersService);
  });

  it('1. Provider registration accepts and saves description and selected amenities', async () => {
    const created = await service.create(mockUserProviderA.id, {
      name: 'Nikhil PG',
      city: 'Bangalore',
      address: 'Koramangala 5th Block',
      monthlyPrice: 2999,
      totalCapacity: 50,
      description: 'Comfortable PG with homemade meals and a clean dining area.',
      amenities: ['WIFI', 'TV', 'HOT WATER', 'PARKING', 'GYM', 'COOL WATER', '24/7 Security'],
    });

    expect(created.name).toBe('Nikhil PG');
    expect(created.description).toBe('Comfortable PG with homemade meals and a clean dining area.');
    expect(created.amenities).toEqual([
      'WIFI',
      'TV',
      'HOT WATER',
      'PARKING',
      'GYM',
      'COOL WATER',
      '24/7 Security',
    ]);
  });

  it('2. Custom amenities and standard amenities are deduplicated case-insensitively', async () => {
    const created = await service.create(mockUserProviderA.id, {
      name: 'Duplicate Test PG',
      city: 'Bangalore',
      description: '   Testing trimming and duplicate amenities   ',
      amenities: ['WIFI', 'wifi', '  HOT WATER  ', 'hot water', 'GYM', '24/7 Security', '24/7 security'],
    });

    expect(created.description).toBe('Testing trimming and duplicate amenities');
    expect(created.amenities).toEqual(['WIFI', 'HOT WATER', 'GYM', '24/7 Security']);
  });

  it('3. Whitespace-only description is normalized to undefined', async () => {
    const created = await service.create(mockUserProviderA.id, {
      name: 'Whitespace PG',
      city: 'Bangalore',
      description: '    \n\t   ',
      amenities: ['WIFI'],
    });

    expect(created.description).toBeUndefined();
  });

  it('4. Provider can update their own description and amenities', async () => {
    const initial = await service.create(mockUserProviderA.id, {
      name: 'Editable PG',
      city: 'Bangalore',
      description: 'Initial description',
      amenities: ['WIFI', 'TV'],
    });

    const updated = await service.update(mockUserProviderA.id, initial.id, {
      description: 'Updated fresh description with daily buffet.',
      amenities: ['WIFI', 'TV', 'HOT WATER', 'RO Water', 'CCTV'],
    });

    expect(updated.description).toBe('Updated fresh description with daily buffet.');
    expect(updated.amenities).toEqual(['WIFI', 'TV', 'HOT WATER', 'RO Water', 'CCTV']);
  });

  it('5. Provider A cannot modify Provider B description or amenities (Ownership security)', async () => {
    const provB = await service.create(mockUserProviderB.id, {
      name: 'Provider B Kitchen',
      city: 'Chennai',
      description: 'Original B Description',
      amenities: ['TV'],
    });

    await expect(
      service.update(mockUserProviderA.id, provB.id, {
        description: 'Malicious modification by Provider A',
        amenities: ['HACKED'],
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('6. Existing providers without description and amenities work normally without breaking', async () => {
    const existing = await service.create(mockUserProviderA.id, {
      name: 'Legacy Mess',
      city: 'Hyderabad',
    });

    const fetched = await service.findById(existing.id);
    expect(fetched.name).toBe('Legacy Mess');
    expect(fetched.description).toBeUndefined();
    expect(fetched.amenities).toEqual([]);
    expect(fetched.totalCapacity).toBe(50);
  });

  it('7. Provider can upload valid hostel images (JPEG, PNG, WebP)', async () => {
    const providerA = await service.create(mockUserProviderA.id, {
      name: 'Hostel A',
      city: 'Bangalore',
    });

    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00]);
    const file = {
      buffer: jpegBuffer,
      mimetype: 'image/jpeg',
      size: jpegBuffer.length,
      originalname: 'room.jpg',
    };

    const uploaded = await service.uploadImage(mockUserProviderA.id, file, providerA.id);
    expect(uploaded).toBeDefined();
    expect(uploaded.providerId).toBe(providerA.id);
    expect(uploaded.imageUrl).toBe('https://res.cloudinary.com/demo/image/upload/sample.jpg');
    expect(uploaded.sortOrder).toBe(0);

    const images = await service.getProviderImages(providerA.id);
    expect(images.length).toBe(1);
  });

  it('8. Maximum 10 images per provider limit is strictly enforced (11th upload rejected)', async () => {
    const providerA = await service.create(mockUserProviderA.id, {
      name: 'Capacity PG',
      city: 'Bangalore',
    });

    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48]);
    const file = {
      buffer: pngBuffer,
      mimetype: 'image/png',
      size: pngBuffer.length,
      originalname: 'room.png',
    };

    // Upload 10 images
    for (let i = 0; i < 10; i++) {
      await service.uploadImage(mockUserProviderA.id, file, providerA.id);
    }

    const imagesCount = (await service.getProviderImages(providerA.id)).length;
    expect(imagesCount).toBe(10);

    // 11th image should be rejected
    await expect(
      service.uploadImage(mockUserProviderA.id, file, providerA.id),
    ).rejects.toThrow(BadRequestException);
  });

  it('9. Provider A cannot upload images to Provider B profile (Ownership protection)', async () => {
    const providerB = await service.create(mockUserProviderB.id, {
      name: 'Hostel B',
      city: 'Chennai',
    });

    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00]);
    const file = {
      buffer: jpegBuffer,
      mimetype: 'image/jpeg',
      size: jpegBuffer.length,
    };

    await expect(
      service.uploadImage(mockUserProviderA.id, file, providerB.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it('10. Provider A cannot delete Provider B images (Ownership protection)', async () => {
    const providerB = await service.create(mockUserProviderB.id, {
      name: 'Hostel B',
      city: 'Chennai',
    });

    const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);
    const file = {
      buffer: webpBuffer,
      mimetype: 'image/webp',
      size: webpBuffer.length,
    };

    const uploaded = await service.uploadImage(mockUserProviderB.id, file, providerB.id);

    await expect(
      service.deleteImage(mockUserProviderA.id, uploaded.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it('11. Provider can successfully delete their own image', async () => {
    const providerA = await service.create(mockUserProviderA.id, {
      name: 'Hostel A',
      city: 'Bangalore',
    });

    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00]);
    const file = {
      buffer: jpegBuffer,
      mimetype: 'image/jpeg',
      size: jpegBuffer.length,
    };

    const uploaded = await service.uploadImage(mockUserProviderA.id, file, providerA.id);
    expect((await service.getProviderImages(providerA.id)).length).toBe(1);

    const deleteResult = await service.deleteImage(mockUserProviderA.id, uploaded.id);
    expect(deleteResult.success).toBe(true);
    expect((await service.getProviderImages(providerA.id)).length).toBe(0);
  });

  it('12. Invalid or non-image files are rejected by signature validation', async () => {
    const providerA = await service.create(mockUserProviderA.id, {
      name: 'Hostel A',
      city: 'Bangalore',
    });

    const invalidBuffer = Buffer.from('<?php echo "evil"; ?>fake-image-contents');
    const file = {
      buffer: invalidBuffer,
      mimetype: 'image/jpeg',
      size: invalidBuffer.length,
    };

    await expect(
      service.uploadImage(mockUserProviderA.id, file, providerA.id),
    ).rejects.toThrow(BadRequestException);
  });

  it('13. Oversized files (>10MB) are rejected', async () => {
    const providerA = await service.create(mockUserProviderA.id, {
      name: 'Hostel A',
      city: 'Bangalore',
    });

    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;

    const file = {
      buffer: oversizedBuffer,
      mimetype: 'image/jpeg',
      size: 11 * 1024 * 1024,
    };

    await expect(
      service.uploadImage(mockUserProviderA.id, file, providerA.id),
    ).rejects.toThrow(BadRequestException);
  });

  it('14. Upload image saves category and metadata', async () => {
    const providerA = await service.create(mockUserProviderA.id, {
      name: 'Hostel With Metadata',
      city: 'Bangalore',
    });

    const validBuf = Buffer.alloc(100);
    validBuf[0] = 0xff;
    validBuf[1] = 0xd8;
    validBuf[2] = 0xff;

    const file = {
      buffer: validBuf,
      mimetype: 'image/jpeg',
      originalname: 'dining_hall.jpg',
      size: 100,
    };

    const uploaded = await service.uploadImage(
      mockUserProviderA.id,
      file,
      providerA.id,
      'Dining Area',
    );

    expect(uploaded.imageCategory).toBe('Dining Area');
    expect(uploaded.originalFileName).toBe('dining_hall.jpg');
    expect(uploaded.imageType).toBe('image/jpeg');
  });

  it('15. Replace image updates image url and category without changing sort order', async () => {
    const providerA = await service.create(mockUserProviderA.id, {
      name: 'Hostel Replace Test',
      city: 'Bangalore',
    });

    const validBuf = Buffer.alloc(100);
    validBuf[0] = 0xff;
    validBuf[1] = 0xd8;
    validBuf[2] = 0xff;

    const initialFile = {
      buffer: validBuf,
      mimetype: 'image/jpeg',
      originalname: 'room_old.jpg',
      size: 100,
    };

    const initial = await service.uploadImage(
      mockUserProviderA.id,
      initialFile,
      providerA.id,
      'Room',
    );

    const newBuf = Buffer.alloc(200);
    newBuf[0] = 0x89;
    newBuf[1] = 0x50;
    newBuf[2] = 0x4e;
    newBuf[3] = 0x47;
    newBuf[4] = 0x0d;
    newBuf[5] = 0x0a;
    newBuf[6] = 0x1a;
    newBuf[7] = 0x0a;

    const newFile = {
      buffer: newBuf,
      mimetype: 'image/png',
      originalname: 'room_new.png',
      size: 200,
    };

    const replaced = await service.replaceImage(
      mockUserProviderA.id,
      initial.id,
      newFile,
      'Kitchen',
    );

    expect(replaced.id).toBe(initial.id);
    expect(replaced.imageCategory).toBe('Kitchen');
    expect(replaced.originalFileName).toBe('room_new.png');
    expect(replaced.imageType).toBe('image/png');
  });
});

