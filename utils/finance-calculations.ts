export function safeNumber(value: string, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function calculateLoanPayment(
  principal: number,
  annualRate: number,
  months: number
): { monthlyPayment: number; totalPayment: number; totalInterest: number } {
  if (months <= 0) {
    return { monthlyPayment: 0, totalPayment: 0, totalInterest: 0 };
  }

  if (annualRate === 0) {
    const monthlyPayment = principal / months;
    const totalPayment = monthlyPayment * months;
    return { monthlyPayment, totalPayment, totalInterest: 0 };
  }

  const monthlyRate = annualRate / 12;
  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);
  const totalPayment = payment * months;

  return {
    monthlyPayment: payment,
    totalPayment,
    totalInterest: totalPayment - principal,
  };
}

export function calculateInvestmentGrowth(
  principal: number,
  annualRate: number,
  years: number
): { futureValue: number; totalInterest: number; annualGrowth: number } {
  if (years <= 0) {
    return { futureValue: principal, totalInterest: 0, annualGrowth: 0 };
  }

  const monthlyRate = annualRate / 12;
  const totalMonths = years * 12;
  const futureValue = principal * Math.pow(1 + monthlyRate, totalMonths);
  const totalInterest = futureValue - principal;
  const annualGrowth = principal > 0 ? Math.pow(futureValue / principal, 1 / years) - 1 : 0;

  return { futureValue, totalInterest, annualGrowth };
}

export function calculateSavingsGoal(
  current: number,
  monthly: number,
  target: number,
  months: number
): { needed: number; monthlyRequired: number; monthsNeeded: number } {
  const needed = Math.max(0, target - current);
  const monthlyRequired = months > 0 ? needed / months : 0;
  const monthsNeeded = monthly > 0 ? needed / monthly : 0;

  return { needed, monthlyRequired, monthsNeeded };
}

export function simulateDebtPayoff(
  principal: number,
  monthlyPayment: number,
  annualRate: number,
  maxMonths = 480
): { totalMonths: number; totalInterest: number; paidOff: boolean } {
  let balance = principal;
  let totalMonths = 0;
  let totalInterest = 0;
  const monthlyRate = annualRate / 12;

  while (balance > 0 && totalMonths < maxMonths) {
    const interest = balance * monthlyRate;
    const principalPayment = monthlyPayment - interest;
    if (principalPayment <= 0) {
      return { totalMonths, totalInterest, paidOff: false };
    }

    balance = Math.max(0, balance - principalPayment);
    totalInterest += interest;
    totalMonths += 1;
  }

  return { totalMonths, totalInterest, paidOff: balance <= 0 };
}
