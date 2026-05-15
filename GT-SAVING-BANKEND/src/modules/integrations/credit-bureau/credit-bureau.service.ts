import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CreditBureauService {
  private readonly logger = new Logger(CreditBureauService.name);
  constructor(private config: ConfigService) {}

  async checkCustomer(customerId: string) {
    const apiKey = this.config.get('CREDIT_BUREAU_API_KEY');
    if (!apiKey) {
      this.logger.warn('Credit bureau not configured — returning default score');
      return { score: 600, grade: 'C', delinquencyCount: 0, totalExposure: 0, details: { note: 'Manual review required' } };
    }
    // Real integration would call bureau API here
    return { score: 650, grade: 'B', delinquencyCount: 0, totalExposure: 0, details: {} };
  }

  scoreToGrade(score: number): string {
    if (score >= 750) return 'A';
    if (score >= 650) return 'B';
    if (score >= 550) return 'C';
    if (score >= 450) return 'D';
    return 'E';
  }
}
