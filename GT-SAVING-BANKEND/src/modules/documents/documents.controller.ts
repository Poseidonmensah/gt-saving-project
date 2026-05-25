import { Controller, Get, Post, Delete, Param, Query, UseGuards, UploadedFile, UseInterceptors, Body } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('documents')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('documents')
export class DocumentsController {
  constructor(private readonly svc: DocumentsService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { entityType: string; entityId: string; documentType: string; accessLevel?: string },
    @CurrentUser('userId') userId: string,
  ) { return this.svc.upload(body, file, userId); }

  @Get('entity/:entityType/:entityId')
  findByEntity(@Param('entityType') et: string, @Param('entityId') eid: string) {
    return this.svc.findByEntity(et, eid);
  }

  @Get(':documentId')
  findById(@Param('documentId') id: string) { return this.svc.findById(id); }

  @Delete(':documentId')
  @Roles('super_admin','admin')
  delete(@Param('documentId') id: string, @CurrentUser('userId') userId: string) {
    return this.svc.delete(id, userId);
  }
}
