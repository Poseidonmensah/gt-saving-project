import Decimal from 'decimal.js';
import { addDays, differenceInDays, isLeapYear, getDaysInYear } from 'date-fns';

// Configure Decimal.js for maximum precision
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// All monetary values are stored as BIGINT (pesewas = GHS × 100)
// Never use floating point arithmetic for money

export class FinancialMath {
  /**
   * Convert GHS to pesewas (integer)
   */
  static toPesewas(ghs: number | string): bigint {
    return BigInt(new Decimal(ghs).mul(100).toFixed(0));
  }

  /**
   * Convert pesewas to GHS
   */
  static toGHS(pesewas: bigint): string {
    return new Decimal(pesewas.toString()).div(100).toFixed(2);
  }

  /**
   * Calculate simple daily interest accrual (pesewas)
   * rate: annual rate as decimal (e.g., 0.12 for 12%)
   * balance: in pesewas
   * days: number of days (default 1)
   */
  static calcDailyInterest(balance: bigint, annualRate: string, days = 1, daysInYear = 365): bigint {
    const b = new Decimal(balance.toString());
    const r = new Decimal(annualRate);
    const d = new Decimal(days);
    const y = new Decimal(daysInYear);

    // interest = balance × rate × days / daysInYear
    const interest = b.mul(r).mul(d).div(y);
    return BigInt(interest.toFixed(0, Decimal.ROUND_HALF_UP));
  }

  /**
   * Calculate reducing balance loan EMI (in pesewas)
   * principal: loan amount in pesewas
   * annualRate: e.g. "0.30" for 30%
   * tenorMonths: number of monthly installments
   */
  static calcReducingBalanceEMI(principal: bigint, annualRate: string, tenorMonths: number): bigint {
    const P = new Decimal(principal.toString());
    const monthlyRate = new Decimal(annualRate).div(12);

    if (monthlyRate.isZero()) {
      // Zero-interest: equal principal payments
      return BigInt(P.div(tenorMonths).toFixed(0, Decimal.ROUND_HALF_UP));
    }

    // EMI = P × r(1+r)^n / ((1+r)^n - 1)
    const onePlusR = monthlyRate.plus(1);
    const onePlusRpowN = onePlusR.pow(tenorMonths);
    const emi = P.mul(monthlyRate).mul(onePlusRpowN).div(onePlusRpowN.minus(1));

    return BigInt(emi.toFixed(0, Decimal.ROUND_HALF_UP));
  }

  /**
   * Calculate flat rate loan EMI (in pesewas)
   */
  static calcFlatRateEMI(principal: bigint, annualRate: string, tenorMonths: number): bigint {
    const P = new Decimal(principal.toString());
    const r = new Decimal(annualRate);
    const n = new Decimal(tenorMonths);

    // Total interest = principal × rate × tenor (in years)
    const totalInterest = P.mul(r).mul(n.div(12));
    const totalPayable = P.plus(totalInterest);
    const emi = totalPayable.div(n);

    return BigInt(emi.toFixed(0, Decimal.ROUND_HALF_UP));
  }

  /**
   * Generate full reducing-balance repayment schedule
   */
  static generateReducingBalanceSchedule(
    principal: bigint,
    annualRate: string,
    tenorMonths: number,
    disbursementDate: Date,
    firstRepaymentDate: Date,
    gracePeriodDays = 0,
  ): Array<{
    installmentNo: number;
    dueDate: Date;
    openingBalance: bigint;
    principalDue: bigint;
    interestDue: bigint;
    totalDue: bigint;
    closingBalance: bigint;
  }> {
    const emi = this.calcReducingBalanceEMI(principal, annualRate, tenorMonths);
    const monthlyRate = new Decimal(annualRate).div(12);
    const schedule = [];
    let balance = new Decimal(principal.toString());
    let currentDate = firstRepaymentDate;

    for (let i = 1; i <= tenorMonths; i++) {
      const openingBalance = balance;
      const interestDue = balance.mul(monthlyRate);
      let principalDue = new Decimal(emi.toString()).minus(interestDue);

      // Last installment: clear remaining balance
      if (i === tenorMonths) {
        principalDue = balance;
      }

      const closingBalance = openingBalance.minus(principalDue);
      const interestBigInt = BigInt(interestDue.toFixed(0, Decimal.ROUND_HALF_UP));
      const principalBigInt = BigInt(principalDue.toFixed(0, Decimal.ROUND_HALF_UP));

      schedule.push({
        installmentNo: i,
        dueDate: new Date(currentDate),
        openingBalance: BigInt(openingBalance.toFixed(0, Decimal.ROUND_HALF_UP)),
        principalDue: principalBigInt,
        interestDue: interestBigInt,
        totalDue: principalBigInt + interestBigInt,
        closingBalance: BigInt(closingBalance.toFixed(0, Decimal.ROUND_HALF_UP)),
      });

      balance = closingBalance.isNegative() ? new Decimal(0) : closingBalance;
      // Advance date by 1 month
      currentDate = new Date(currentDate);
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return schedule;
  }

  /**
   * Generate flat rate repayment schedule
   */
  static generateFlatRateSchedule(
    principal: bigint,
    annualRate: string,
    tenorMonths: number,
    firstRepaymentDate: Date,
  ) {
    const P = new Decimal(principal.toString());
    const r = new Decimal(annualRate);
    const n = new Decimal(tenorMonths);
    const totalInterest = P.mul(r).mul(n.div(12));
    const interestPerMonth = totalInterest.div(n);
    const principalPerMonth = P.div(n);
    const emi = principalPerMonth.plus(interestPerMonth);

    const schedule = [];
    let currentDate = firstRepaymentDate;
    let remainingPrincipal = P;

    for (let i = 1; i <= tenorMonths; i++) {
      const isLast = i === tenorMonths;
      const principalDue = isLast ? remainingPrincipal : principalPerMonth;
      const interestDue = isLast
        ? new Decimal(emi.toString()).minus(principalDue)
        : interestPerMonth;

      const principalBigInt = BigInt(principalDue.toFixed(0, Decimal.ROUND_HALF_UP));
      const interestBigInt = BigInt(interestDue.toFixed(0, Decimal.ROUND_HALF_UP));

      schedule.push({
        installmentNo: i,
        dueDate: new Date(currentDate),
        openingBalance: BigInt(remainingPrincipal.toFixed(0, Decimal.ROUND_HALF_UP)),
        principalDue: principalBigInt,
        interestDue: interestBigInt,
        totalDue: principalBigInt + interestBigInt,
        closingBalance: BigInt(remainingPrincipal.minus(principalDue).toFixed(0, Decimal.ROUND_HALF_UP)),
      });

      remainingPrincipal = remainingPrincipal.minus(principalDue);
      currentDate = new Date(currentDate);
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return schedule;
  }

  /**
   * Calculate FD maturity value
   * interest = principal × rate × days / 365
   */
  static calcFDMaturityValue(
    principal: bigint,
    annualRate: string,
    tenorDays: number,
  ): { interest: bigint; maturityValue: bigint } {
    const interest = this.calcDailyInterest(principal, annualRate, tenorDays, 365);
    return { interest, maturityValue: principal + interest };
  }

  /**
   * Calculate daily penalty on overdue principal
   */
  static calcDailyPenalty(
    outstandingPrincipal: bigint,
    dailyPenaltyRate: string,
    daysOverdue: number,
  ): bigint {
    if (daysOverdue <= 0) return 0n;
    const p = new Decimal(outstandingPrincipal.toString());
    const r = new Decimal(dailyPenaltyRate);
    const d = new Decimal(daysOverdue);
    return BigInt(p.mul(r).mul(d).toFixed(0, Decimal.ROUND_HALF_UP));
  }

  /**
   * Calculate fee based on config
   */
  static calcFee(
    amount: bigint,
    feeType: 'flat' | 'percentage' | 'tier',
    flatAmount?: bigint,
    percentageRate?: string,
    tiers?: Array<{ from: number; to: number; rate: number }>,
  ): bigint {
    if (feeType === 'flat' && flatAmount !== undefined) {
      return flatAmount;
    }
    if (feeType === 'percentage' && percentageRate) {
      const a = new Decimal(amount.toString());
      const r = new Decimal(percentageRate);
      return BigInt(a.mul(r).toFixed(0, Decimal.ROUND_HALF_UP));
    }
    if (feeType === 'tier' && tiers) {
      const amountGHS = Number(amount) / 100;
      for (const tier of tiers) {
        if (amountGHS >= tier.from && (tier.to === 0 || amountGHS <= tier.to)) {
          const a = new Decimal(amount.toString());
          const r = new Decimal(tier.rate.toString());
          return BigInt(a.mul(r).toFixed(0, Decimal.ROUND_HALF_UP));
        }
      }
    }
    return 0n;
  }

  /**
   * Ensure debit + credit balances for journal validation
   */
  static validateJournal(entries: Array<{ type: 'debit' | 'credit'; amount: bigint }>): boolean {
    let totalDebits = 0n;
    let totalCredits = 0n;
    for (const entry of entries) {
      if (entry.type === 'debit') totalDebits += entry.amount;
      else totalCredits += entry.amount;
    }
    return totalDebits === totalCredits;
  }

  /**
   * Format bigint pesewas to display string
   */
  static format(pesewas: bigint, currency = 'GHS'): string {
    const ghs = Number(pesewas) / 100;
    return `${currency} ${ghs.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export function getDaysInYearForDate(date: Date): number {
  return isLeapYear(date) ? 366 : 365;
}

export function generateRef(prefix: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}
