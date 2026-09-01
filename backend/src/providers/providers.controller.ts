import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Patch,
  Delete,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProvidersService } from './providers.service';
import { ProviderDto } from './dto/provider.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { Category } from '../common/enums/category.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async create(@Req() req: AuthenticatedRequest, @Body() dto: ProviderDto) {
    return this.providersService.create(req.user.userId, dto);
  }

  @Get()
  async findAll(@Query('category') category?: Category) {
    const filters = category ? { category } : undefined;
    return this.providersService.findAll(filters);
  }

  @Get('categories')
  getCategories() {
    return Object.values(Category);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async findMyProviders(@Req() req: AuthenticatedRequest) {
    return this.providersService.findByUserId(req.user.userId);
  }

  @Post('me/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  @UseInterceptors(FileInterceptor('file'))
  async uploadMyImage(
    @Req() req: AuthenticatedRequest,
    @UploadedFile() file: any,
    @Query('providerId') providerId?: string,
    @Body('providerId') bodyProviderId?: string,
    @Query('imageCategory') queryCategory?: string,
    @Body('imageCategory') bodyCategory?: string,
    @Query('category') qCat?: string,
    @Body('category') bCat?: string,
  ) {
    const targetProviderId = providerId || bodyProviderId;
    const category = queryCategory || bodyCategory || qCat || bCat;
    return this.providersService.uploadImage(
      req.user.userId,
      file,
      targetProviderId,
      category,
    );
  }

  @Put('me/images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  @UseInterceptors(FileInterceptor('file'))
  async replaceMyImage(
    @Req() req: AuthenticatedRequest,
    @Param('imageId') imageId: string,
    @UploadedFile() file: any,
    @Query('imageCategory') queryCategory?: string,
    @Body('imageCategory') bodyCategory?: string,
    @Query('category') qCat?: string,
    @Body('category') bCat?: string,
  ) {
    const category = queryCategory || bodyCategory || qCat || bCat;
    return this.providersService.replaceImage(
      req.user.userId,
      imageId,
      file,
      category,
    );
  }

  @Get('me/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async getMyImages(
    @Req() req: AuthenticatedRequest,
    @Query('providerId') providerId?: string,
  ) {
    return this.providersService.getMyImages(req.user.userId, providerId);
  }

  @Delete('me/images/:imageId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async deleteMyImage(
    @Req() req: AuthenticatedRequest,
    @Param('imageId') imageId: string,
  ) {
    return this.providersService.deleteImage(req.user.userId, imageId);
  }

  @Get('search')
  async search(
    @Query('name') name?: string,
    @Query('city') city?: string,
    @Query('category') category?: Category,
  ) {
    return this.providersService.search({ name, city, category });
  }

  @Get('nearby')
  async findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedRadius = radius ? parseFloat(radius) : 5;
    return this.providersService.findNearby(parsedLat, parsedLng, parsedRadius);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async findPending() {
    return this.providersService.findPending();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.providersService.findById(id);
  }

  @Get(':id/images')
  async findImages(@Param('id') id: string) {
    return this.providersService.getProviderImages(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ProviderDto,
  ) {
    return this.providersService.update(req.user.userId, id, dto);
  }

  @Patch(':id/subscription-break-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async updateBreakSettings(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { subscriptionBreaksEnabled: boolean },
  ) {
    return this.providersService.updateBreakSettings(
      id,
      req.user.userId,
      body.subscriptionBreaksEnabled,
    );
  }

  @Patch('approve/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async approve(@Param('id') id: string) {
    return this.providersService.approve(id);
  }

  @Patch('reject/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async reject(@Param('id') id: string) {
    return this.providersService.reject(id);
  }
}
