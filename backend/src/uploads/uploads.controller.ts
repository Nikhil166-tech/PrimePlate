import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { UploadsService } from './uploads.service';

@ApiTags('Providers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('providers')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('upload-image')
  @Roles(Role.PROVIDER)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload provider image to Cloudinary' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Image uploaded',
    schema: { example: { url: 'https://res.cloudinary.com/.../image.jpg' } },
  })
  async upload(@UploadedFile() file: any) {
    if (!file) throw new BadRequestException('No image file provided in request');
    const result = await this.uploadsService.upload(file);
    return { url: result.secure_url };
  }
}
