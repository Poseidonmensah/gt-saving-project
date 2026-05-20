// ============================================================
// src/modules/customers/customer.entity.ts
// ============================================================
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('customers')
export class CustomerEntity {
  @PrimaryColumn({ name: 'customer_id' }) customerId: string;
  @Column({ name: 'customer_number', unique: true }) customerNumber: string;
  @Column({ name: 'full_name' }) fullName: string;
  @Column({ name: 'date_of_birth', nullable: true }) dateOfBirth: Date;
  @Column({ name: 'gender', nullable: true }) gender: string;
  @Column({ name: 'nationality', nullable: true }) nationality: string;
  @Column({ name: 'id_type', nullable: true }) idType: string;
  @Column({ name: 'id_number', nullable: true }) idNumber: string;
  @Column({ name: 'id_expiry_date', nullable: true }) idExpiryDate: Date;
  @Column({ name: 'kyc_tier', default: 'tier_1' }) kycTier: string;
  @Column({ name: 'kyc_status', default: 'pending' }) kycStatus: string;
  @Column({ name: 'risk_rating', default: 'low' }) riskRating: string;
  @Column({ name: 'phone_number' }) phoneNumber: string;
  @Column({ name: 'alt_phone', nullable: true }) altPhone: string;
  @Column({ name: 'email', nullable: true }) email: string;
  @Column({ name: 'address', nullable: true }) address: string;
  @Column({ name: 'gps_address', nullable: true }) gpsAddress: string;
  @Column({ name: 'region', nullable: true }) region: string;
  @Column({ name: 'occupation', nullable: true }) occupation: string;
  @Column({ name: 'employer_name', nullable: true }) employerName: string;
  @Column({ name: 'source_of_funds', nullable: true }) sourceOfFunds: string;
  @Column({ name: 'pep_flag', default: false }) pepFlag: boolean;
  @Column({ name: 'sanctions_flag', default: false }) sanctionsFlag: boolean;
  @Column({ name: 'status', default: 'prospect' }) status: string;
  @Column({ name: 'branch_id' }) branchId: string;
  @Column({ name: 'relationship_officer_id', nullable: true }) relationshipOfficerId: string;
  @Column({ name: 'portal_user_id', nullable: true }) portalUserId: string;
  @Column({ name: 'created_by' }) createdBy: string;
  @Column({ name: 'approved_by', nullable: true }) approvedBy: string;
  @Column({ name: 'approved_at', nullable: true }) approvedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

// ============================================================
// src/modules/customers/customers.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { KycModule } from '../integrations/kyc/kyc.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomerEntity]),
    AuditModule,
    NotificationsModule,
    KycModule,
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService, TypeOrmModule],
})
export class CustomersModule {}

// ============================================================
// src/modules/customers/customers.service.ts
// ============================================================
import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, ILike } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { KycService } from '../integrations/kyc/kyc.service';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(CustomerEntity) private repo: Repository<CustomerEntity>,
    private audit: AuditService,
    private notifications: NotificationsService,
    private kyc: KycService,
  ) {}

  async create(dto: CreateCustomerDto, createdBy: string): Promise<CustomerEntity> {
    // Check for duplicate ID document
    if (dto.idNumber && dto.idType) {
      const dup = await this.repo.findOne({ where: { idType: dto.idType, idNumber: dto.idNumber } });
      if (dup) throw new ConflictException(`Customer with ${dto.idType} ${dto.idNumber} already exists (${dup.customerNumber})`);
    }

    // Check duplicate phone
    const phoneDup = await this.repo.findOne({ where: { phoneNumber: dto.phoneNumber } });
    if (phoneDup) throw new ConflictException(`Phone number already registered to ${phoneDup.fullName} (${phoneDup.customerNumber})`);

    // Generate customer number
    const customerNumber = await this.generateCustomerNumber();

    const customer = this.repo.create({
      customerId: uuid(),
      customerNumber,
      fullName: dto.fullName,
      dateOfBirth: dto.dateOfBirth,
      gender: dto.gender,
      nationality: dto.nationality || 'Ghanaian',
      idType: dto.idType,
      idNumber: dto.idNumber,
      idExpiryDate: dto.idExpiryDate,
      kycTier: 'tier_1',
      kycStatus: 'pending',
      riskRating: 'low',
      phoneNumber: dto.phoneNumber,
      altPhone: dto.altPhone,
      email: dto.email,
      address: dto.address,
      gpsAddress: dto.gpsAddress,
      region: dto.region,
      occupation: dto.occupation,
      employerName: dto.employerName,
      sourceOfFunds: dto.sourceOfFunds,
      pepFlag: false,
      sanctionsFlag: false,
      status: 'prospect',
      branchId: dto.branchId,
      relationshipOfficerId: createdBy,
      createdBy,
    });

    const saved = await this.repo.save(customer);

    await this.audit.log({
      actorUserId: createdBy,
      actorRole: 'teller',
      actionType: 'CUSTOMER_CREATED',
      entityType: 'customer',
      entityId: saved.customerId,
      afterValue: { customerNumber: saved.customerNumber, fullName: saved.fullName },
    });

    // Trigger KYC screening in background
    this.initiateKycScreening(saved.customerId, saved).catch(err =>
      console.error('KYC screening failed:', err)
    );

    return saved;
  }

  async initiateKycScreening(customerId: string, customer: CustomerEntity) {
    try {
      // PEP/Sanctions screening
      const screeningResult = await this.kyc.screenCustomer({
        fullName: customer.fullName,
        dateOfBirth: customer.dateOfBirth,
        idNumber: customer.idNumber,
        nationality: customer.nationality,
      });

      const updates: Partial<CustomerEntity> = {};
      if (screeningResult.pepMatch) updates.pepFlag = true;
      if (screeningResult.sanctionsMatch) {
        updates.sanctionsFlag = true;
        updates.riskRating = 'sanctioned';
        updates.status = 'restricted';
      }

      if (Object.keys(updates).length > 0) {
        await this.repo.update(customerId, updates);
      }
    } catch (err) {
      console.error('KYC screening error:', err);
    }
  }

  async search(query: SearchCustomerDto) {
    const qb = this.repo.createQueryBuilder('c');

    if (query.customerNumber) {
      qb.andWhere('c.customer_number ILIKE :cn', { cn: `%${query.customerNumber}%` });
    }
    if (query.fullName) {
      qb.andWhere('c.full_name ILIKE :fn', { fn: `%${query.fullName}%` });
    }
    if (query.phoneNumber) {
      qb.andWhere('c.phone_number LIKE :ph', { ph: `%${query.phoneNumber}%` });
    }
    if (query.idNumber) {
      qb.andWhere('c.id_number = :id', { id: query.idNumber });
    }
    if (query.status) {
      qb.andWhere('c.status = :status', { status: query.status });
    }
    if (query.branchId) {
      qb.andWhere('c.branch_id = :branch', { branch: query.branchId });
    }

    qb.orderBy('c.created_at', 'DESC')
      .skip(((query.page || 1) - 1) * (query.limit || 20))
      .take(query.limit || 20);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page: query.page || 1, limit: query.limit || 20 } };
  }

  async findById(customerId: string): Promise<CustomerEntity> {
    const customer = await this.repo.findOne({ where: { customerId } });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async findByCustomerNumber(customerNumber: string): Promise<CustomerEntity> {
    const customer = await this.repo.findOne({ where: { customerNumber } });
    if (!customer) throw new NotFoundException(`Customer ${customerNumber} not found`);
    return customer;
  }

  async updateKycStatus(
    customerId: string,
    status: string,
    tier: string,
    reviewedBy: string,
    notes?: string,
  ) {
    const customer = await this.findById(customerId);
    const before = { kycStatus: customer.kycStatus, kycTier: customer.kycTier };

    const updates: Partial<CustomerEntity> = { kycStatus: status, kycTier: tier };
    if (status === 'approved') updates.status = 'active';

    await this.repo.update(customerId, updates);

    await this.audit.log({
      actorUserId: reviewedBy,
      actorRole: 'compliance_officer',
      actionType: 'KYC_STATUS_UPDATED',
      entityType: 'customer',
      entityId: customerId,
      beforeValue: before,
      afterValue: updates,
      description: notes,
    });

    if (status === 'approved' && customer.phoneNumber) {
      await this.notifications.sendSms(
        customer.phoneNumber,
        `Dear ${customer.fullName}, your Good Time S&L account has been approved. Customer No: ${customer.customerNumber}. Welcome!`,
      );
    }

    return this.findById(customerId);
  }

  async freezeAccount(customerId: string, reason: string, officerId: string) {
    const customer = await this.findById(customerId);
    if (['closed', 'frozen'].includes(customer.status)) {
      throw new BadRequestException(`Customer is already ${customer.status}`);
    }
    await this.repo.update(customerId, { status: 'frozen' });
    await this.audit.log({
      actorUserId: officerId,
      actorRole: 'compliance_officer',
      actionType: 'CUSTOMER_FROZEN',
      entityType: 'customer',
      entityId: customerId,
      beforeValue: { status: customer.status },
      afterValue: { status: 'frozen' },
      reasonCode: reason,
    });
    return { message: 'Customer account frozen' };
  }

  async update(customerId: string, dto: UpdateCustomerDto, updatedBy: string) {
    const customer = await this.findById(customerId);
    const before = { ...customer };
    await this.repo.update(customerId, dto);
    await this.audit.log({
      actorUserId: updatedBy,
      actorRole: 'customer_care',
      actionType: 'CUSTOMER_UPDATED',
      entityType: 'customer',
      entityId: customerId,
      beforeValue: before,
      afterValue: dto,
    });
    return this.findById(customerId);
  }

  async getCustomerAccounts(customerId: string) {
    // Returns summary — full data from AccountsService
    return this.repo.manager.query(
      `SELECT a.account_number, a.account_type, a.current_balance, a.available_balance, a.status, a.opened_at
       FROM accounts a WHERE a.customer_id = $1 AND a.status != 'closed'`,
      [customerId]
    );
  }

  private async generateCustomerNumber(): Promise<string> {
    const result = await this.repo.manager.query(`SELECT generate_customer_number() as num`);
    return result[0].num;
  }
}

// ============================================================
// src/modules/customers/customers.controller.ts
// ============================================================
import {
  Controller, Get, Post, Body, Patch, Param, Query,
  UseGuards, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/jwt-auth.guard.ts';
import { Roles, CurrentUser } from '../../common/decorators/current-user.decorator.ts';
import {
  IsString, IsOptional, IsEmail, IsDateString,
  IsPhoneNumber, IsNumber, Min, IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

class CreateCustomerDto {
  @IsString() fullName: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsIn(['male','female','other']) gender?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsString() idType?: string;
  @IsOptional() @IsString() idNumber?: string;
  @IsOptional() @IsDateString() idExpiryDate?: string;
  @IsString() phoneNumber: string;
  @IsOptional() @IsString() altPhone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() gpsAddress?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() employerName?: string;
  @IsOptional() @IsString() sourceOfFunds?: string;
  @IsString() branchId: string;
}

class UpdateCustomerDto {
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() altPhone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() occupation?: string;
  @IsOptional() @IsString() employerName?: string;
  @IsOptional() @IsString() gpsAddress?: string;
}

class SearchCustomerDto {
  @IsOptional() @IsString() customerNumber?: string;
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsString() phoneNumber?: string;
  @IsOptional() @IsString() idNumber?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @Type(() => Number) @IsNumber() page?: number;
  @IsOptional() @Type(() => Number) @IsNumber() limit?: number;
}

class KycReviewDto {
  @IsIn(['approved','rejected','in_review']) status: string;
  @IsIn(['tier_1','tier_2','tier_3']) tier: string;
  @IsOptional() @IsString() notes?: string;
}

@ApiTags('customers')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Post()
  @Roles('super_admin','admin','branch_manager','teller','loan_officer','customer_care')
  @ApiOperation({ summary: 'Create new customer record' })
  create(@Body() dto: CreateCustomerDto, @CurrentUser('userId') userId: string) {
    return this.customersService.create(dto, userId);
  }

  @Get()
  @Roles('super_admin','admin','branch_manager','teller','loan_officer','credit_analyst','compliance_officer','customer_care','auditor')
  search(@Query() query: SearchCustomerDto) {
    return this.customersService.search(query);
  }

  @Get(':customerId')
  findOne(@Param('customerId') customerId: string) {
    return this.customersService.findById(customerId);
  }

  @Get(':customerId/accounts')
  getAccounts(@Param('customerId') customerId: string) {
    return this.customersService.getCustomerAccounts(customerId);
  }

  @Patch(':customerId')
  @Roles('super_admin','admin','branch_manager','customer_care')
  update(
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.customersService.update(customerId, dto, userId);
  }

  @Post(':customerId/kyc-review')
  @Roles('super_admin','admin','compliance_officer')
  @ApiOperation({ summary: 'Review and update KYC status' })
  kycReview(
    @Param('customerId') customerId: string,
    @Body() dto: KycReviewDto,
    @CurrentUser('userId') officerId: string,
  ) {
    return this.customersService.updateKycStatus(customerId, dto.status, dto.tier, officerId, dto.notes);
  }

  @Post(':customerId/freeze')
  @Roles('super_admin','admin','compliance_officer')
  freeze(
    @Param('customerId') customerId: string,
    @Body('reason') reason: string,
    @CurrentUser('userId') officerId: string,
  ) {
    return this.customersService.freezeAccount(customerId, reason, officerId);
  }
}
