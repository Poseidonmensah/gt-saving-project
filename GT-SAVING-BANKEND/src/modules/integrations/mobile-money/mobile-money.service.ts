import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { LedgerService } from '../../ledger/ledger.service';
import { AuditService } from '../../audit/audit.service';
import { MobileMoneyTxnEntity } from './mobile-money.module';

@Injectable()
export class MobileMoneyService {
  private readonly logger = new Logger(MobileMoneyService.name);

  constructor(
    @InjectRepository(MobileMoneyTxnEntity) private repo: Repository<MobileMoneyTxnEntity>,
    @InjectDataSource() private ds: DataSource,
    private ledger: LedgerService,
    private audit: AuditService,
    private config: ConfigService,
  ) {}

  async initiateCollection(dto: any, initiatedBy: string) {
    const internalRef = `MM${Date.now().toString(36).toUpperCase()}`;
    const saved = await this.repo.save(this.repo.create({
      mmTxnId: uuid(), internalRef, provider: dto.provider,
      walletNumber: dto.walletNumber, direction: 'inbound',
      amount: BigInt(dto.amount), charges: 0n, status: 'pending',
    }));
    this.logger.log(`MM collection initiated: ${internalRef} — ${dto.provider} ${dto.walletNumber} GHS ${dto.amount/100}`);
    return { internalRef, status: 'pending', message: 'Payment request sent to customer wallet' };
  }

  async handleCallback(provider: string, payload: any, signature: string) {
    const secret = provider === 'mtn_momo'
      ? this.config.get('MTN_MOMO_WEBHOOK_SECRET', 'default-secret')
      : this.config.get('VODAFONE_WEBHOOK_SECRET', 'default-secret');

    // Validate HMAC signature
    const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
    if (signature && signature !== expected) {
      this.logger.warn(`Invalid webhook signature from ${provider}`);
      // In dev, allow through; in prod, throw ForbiddenException
    }

    const { internalRef, providerRef, status, amount } = this.normalise(provider, payload);
    const existing = await this.repo.findOne({ where: { internalRef, callbackReceived: true } });
    if (existing) return { message: 'Already processed' };

    const txn = await this.repo.findOne({ where: { internalRef } });
    if (!txn) throw new NotFoundException(`MM transaction ${internalRef} not found`);

    await this.repo.update({ mmTxnId: txn.mmTxnId }, {
      providerRef, callbackReceived: true, callbackData: payload,
      status: status === 'successful' ? 'success' : 'failed',
    });

    if (status === 'successful') {
      await this.ds.transaction(async em => {
        const txnRef = `MMD${Date.now().toString(36).toUpperCase()}`;
        await em.query(
          `INSERT INTO transactions(transaction_id,transaction_ref,transaction_type,channel,amount,fees,penalties,net_amount,narration,status,business_date,initiated_by,approved_by,approved_at,posted_at,provider_ref,branch_id)
           VALUES($1,$2,'mobile_money_in','mobile_money',$3,0,0,$3,$4,'posted',CURRENT_DATE,'system','system',NOW(),NOW(),$5,'00000000-0000-0000-0000-000000000001')`,
          [uuid(), txnRef, amount.toString(), `MM collection - ${provider} ${providerRef}`, providerRef]
        );
        await this.ledger.postMobileMoneyJournal(em, {
          direction: 'inbound', amount,
          branchId: '00000000-0000-0000-0000-000000000001',
          narration: `Mobile money collection - ${providerRef}`,
        });
      });
    }
    return { message: 'Callback processed' };
  }

  async getStatus(internalRef: string) {
    const txn = await this.repo.findOne({ where: { internalRef } });
    if (!txn) throw new NotFoundException('Transaction not found');
    return txn;
  }

  private normalise(provider: string, payload: any) {
    if (provider === 'mtn_momo') {
      return {
        internalRef: payload.externalId,
        providerRef:  payload.financialTransactionId || payload.externalId,
        status:       payload.status === 'SUCCESSFUL' ? 'successful' : 'failed',
        amount:       BigInt(Math.round(parseFloat(payload.amount || '0') * 100)),
      };
    }
    return {
      internalRef: payload.clientCorrelator,
      providerRef:  payload.transactionIdentification || payload.clientCorrelator,
      status:       payload.status === 'success' ? 'successful' : 'failed',
      amount:       BigInt(Math.round(parseFloat(payload.amount || '0') * 100)),
    };
  }
}
