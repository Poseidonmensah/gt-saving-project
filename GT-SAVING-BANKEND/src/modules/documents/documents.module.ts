import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { AuditModule } from '../audit/audit.module';
import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('documents')
export class DocumentEntity {
  @PrimaryColumn({ name: 'document_id' }) documentId: string;
  @Column({ name: 'document_type' }) documentType: string;
  @Column({ name: 'entity_type' }) entityType: string;
  @Column({ name: 'entity_id' }) entityId: string;
  @Column({ name: 'file_reference' }) fileReference: string;
  @Column({ name: 'file_name' }) fileName: string;
  @Column({ name: 'file_size_bytes', nullable: true }) fileSizeBytes: number;
  @Column({ name: 'mime_type', nullable: true }) mimeType: string;
  @Column({ name: 'checksum', nullable: true }) checksum: string;
  @Column({ name: 'is_virus_scanned', default: false }) isVirusScanned: boolean;
  @Column({ name: 'virus_scan_result', nullable: true }) virusScanResult: string;
  @Column({ name: 'access_level', default: 'internal' }) accessLevel: string;
  @Column({ name: 'uploaded_by' }) uploadedBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    MulterModule.register({
      storage: diskStorage({
        destination: './uploads',
        filename: (_, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extname(file.originalname)}`),
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    }),
    AuditModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
