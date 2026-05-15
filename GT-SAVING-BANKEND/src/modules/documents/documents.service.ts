import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { DocumentEntity } from './documents.module';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(DocumentEntity) private repo: Repository<DocumentEntity>,
    private audit: AuditService,
  ) {}

  async upload(dto: { entityType: string; entityId: string; documentType: string; accessLevel?: string }, file: Express.Multer.File, uploadedBy: string) {
    const checksum = crypto.createHash('sha256').update(file.buffer || file.filename).digest('hex');
    const doc = await this.repo.save(this.repo.create({
      documentId:     uuid(),
      documentType:   dto.documentType,
      entityType:     dto.entityType,
      entityId:       dto.entityId,
      fileReference:  file.path || file.filename,
      fileName:       file.originalname,
      fileSizeBytes:  file.size,
      mimeType:       file.mimetype,
      checksum,
      isVirusScanned: false,
      accessLevel:    dto.accessLevel || 'internal',
      uploadedBy,
    }));
    await this.audit.log({ actorUserId: uploadedBy, actorRole: 'staff', actionType: 'DOCUMENT_UPLOADED', entityType: dto.entityType, entityId: dto.entityId, afterValue: { documentId: doc.documentId, fileName: doc.fileName } });
    return doc;
  }

  async findByEntity(entityType: string, entityId: string) {
    return this.repo.find({ where: { entityType, entityId }, order: { createdAt: 'DESC' } });
  }

  async findById(documentId: string) {
    const doc = await this.repo.findOne({ where: { documentId } });
    if (!doc) throw new NotFoundException('Document not found');
    return doc;
  }

  async delete(documentId: string, userId: string) {
    const doc = await this.findById(documentId);
    await this.repo.delete(documentId);
    await this.audit.log({ actorUserId: userId, actorRole: 'admin', actionType: 'DOCUMENT_DELETED', entityType: 'document', entityId: documentId });
    return { message: 'Document deleted' };
  }
}
