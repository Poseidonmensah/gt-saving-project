import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class FeesService {
  constructor(@InjectDataSource() private ds: DataSource) {}

  async calculateFee(feeCode: string, productCode: string, amountPesewas: number): Promise<number> {
    const [cfg] = await this.ds.query(
      `SELECT * FROM fee_configs WHERE (product_code=$1 OR product_code='ALL')
       AND fee_code=$2 AND is_active=true
       AND (effective_to IS NULL OR effective_to>=CURRENT_DATE)
       ORDER BY product_code DESC LIMIT 1`,
      [productCode, feeCode]
    );
    if (!cfg) return 0;

    const amount = BigInt(amountPesewas);
    let fee = 0n;

    if (cfg.fee_type === 'flat' && cfg.flat_amount) {
      fee = BigInt(cfg.flat_amount);
    } else if (cfg.fee_type === 'percentage' && cfg.percentage_rate) {
      const pct = parseFloat(cfg.percentage_rate);
      fee = BigInt(Math.round(Number(amount) * pct));
    } else if (cfg.fee_type === 'tier' && cfg.tier_config) {
      const tiers = cfg.tier_config as any[];
      const amtGHS = Number(amount) / 100;
      for (const t of tiers) {
        if (amtGHS >= t.from && (!t.to || amtGHS <= t.to)) {
          fee = BigInt(Math.round(Number(amount) * t.rate));
          break;
        }
      }
    }

    const min = cfg.min_amount ? BigInt(cfg.min_amount) : 0n;
    const max = cfg.max_amount ? BigInt(cfg.max_amount) : BigInt(Number.MAX_SAFE_INTEGER);
    if (fee < min) fee = min;
    if (fee > max) fee = max;
    return Number(fee);
  }
}
