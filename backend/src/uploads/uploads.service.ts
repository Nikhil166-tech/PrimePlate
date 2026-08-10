import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class UploadsService {
  constructor(private readonly config: ConfigService) {
    cloudinary.config({
      cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async upload(
    file: { buffer: Buffer; mimetype?: string; size?: number },
    folder: string = 'primeplate',
  ): Promise<{ secure_url: string }> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file uploaded');
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (file.mimetype && !allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type (${file.mimetype}). Allowed types: JPG, PNG, WEBP`,
      );
    }

    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size && file.size > maxSize) {
      throw new BadRequestException('File size exceeds maximum 5MB limit');
    }

    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const isProduction = process.env.NODE_ENV === 'production';

    if (!cloudName || !apiKey) {
      if (isProduction) {
        throw new BadRequestException(
          'Cloudinary configuration missing in production environment. Upload failed.',
        );
      }
      return {
        secure_url:
          'https://images.pexels.com/photos/5775684/pexels-photo-5775684.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
      };
    }

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error)
            reject(new BadRequestException(error.message || 'Cloudinary upload error'));
          else resolve(result as { secure_url: string });
        },
      );
      uploadStream.end(file.buffer);
    });
  }
}
