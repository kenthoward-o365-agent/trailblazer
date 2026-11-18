import { supabase } from "@/integrations/supabase/client";

export interface TaxConfig {
  id: string;
  tax_account_id: string;
  calculation_type: string;
  rate_value: number;
  inclusive_of_tax_id: string | null;
  sort_order: number;
  tax_account?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface CalculatedTax {
  taxAccountId: string;
  taxAccountCode: string;
  taxAccountName: string;
  calculationType: string;
  rateValue: number;
  calculatedAmount: number;
  description: string;
}

export interface TaxCalculationContext {
  numberOfDays?: number;
  numberOfAdults?: number;
}

/**
 * Fetches tax configurations for a revenue account
 */
export async function getRevenueAccountTaxes(revenueAccountId: string): Promise<TaxConfig[]> {
  const { data, error } = await supabase
    .from("account_taxes")
    .select(`
      id,
      tax_account_id,
      calculation_type,
      rate_value,
      inclusive_of_tax_id,
      sort_order
    `)
    .eq("revenue_account_id", revenueAccountId)
    .eq("is_active", true)
    .order("sort_order");

  if (error) {
    console.error("Error fetching account taxes:", error);
    return [];
  }

  // Fetch tax account details
  if (data && data.length > 0) {
    const taxAccountIds = data.map((t) => t.tax_account_id);
    const { data: taxAccounts, error: taxError } = await supabase
      .from("accounts")
      .select("id, code, name")
      .in("id", taxAccountIds);

    if (!taxError && taxAccounts) {
      return data.map((tax) => ({
        ...tax,
        tax_account: taxAccounts.find((a) => a.id === tax.tax_account_id),
      }));
    }
  }

  return data || [];
}

/**
 * Calculates taxes for a revenue amount based on configured tax rules
 * 
 * @param revenueAmount - The base revenue amount (before taxes for additive, gross for VAT inclusive)
 * @param taxConfigs - The tax configurations for the revenue account
 * @param context - Additional context like number of days, adults for flat rate calculations
 * @returns Array of calculated tax amounts
 */
export function calculateTaxes(
  revenueAmount: number,
  taxConfigs: TaxConfig[],
  context: TaxCalculationContext = {}
): CalculatedTax[] {
  const { numberOfDays = 1, numberOfAdults = 1 } = context;
  const calculatedTaxes: CalculatedTax[] = [];
  
  // Sort by sort_order to ensure proper calculation sequence
  const sortedConfigs = [...taxConfigs].sort((a, b) => a.sort_order - b.sort_order);
  
  for (const config of sortedConfigs) {
    let taxAmount = 0;
    let description = "";
    
    switch (config.calculation_type) {
      case "percentage_on_revenue":
      case "percentage": // Legacy support
        // Simple percentage of revenue amount
        taxAmount = revenueAmount * (config.rate_value / 100);
        description = `${config.rate_value}% on revenue`;
        break;
        
      case "percentage_on_tax":
        // Tax on tax (compound) - calculate on sum of previous taxes
        const previousTaxTotal = calculatedTaxes.reduce((sum, t) => sum + t.calculatedAmount, 0);
        if (config.inclusive_of_tax_id) {
          // Only calculate on specific previous tax
          const baseTax = calculatedTaxes.find(t => t.taxAccountId === config.inclusive_of_tax_id);
          taxAmount = (baseTax?.calculatedAmount || 0) * (config.rate_value / 100);
          description = `${config.rate_value}% on ${baseTax?.taxAccountCode || 'tax'}`;
        } else {
          // Calculate on all previous taxes
          taxAmount = previousTaxTotal * (config.rate_value / 100);
          description = `${config.rate_value}% compound on taxes`;
        }
        break;
        
      case "vat_inclusive":
      case "vat": // Legacy support
        // VAT-inclusive: Tax is already embedded in the revenue amount
        // Formula: tax = gross * (rate / (100 + rate))
        taxAmount = revenueAmount * (config.rate_value / (100 + config.rate_value));
        description = `${config.rate_value}% VAT inclusive`;
        break;
        
      case "flat_per_day":
        // Flat amount per day
        taxAmount = config.rate_value * numberOfDays;
        description = `$${config.rate_value}/day × ${numberOfDays} days`;
        break;
        
      case "flat_per_adult":
        // Flat amount per adult
        taxAmount = config.rate_value * numberOfAdults;
        description = `$${config.rate_value}/adult × ${numberOfAdults} adults`;
        break;
        
      case "flat_per_vehicle":
        // Legacy support - treat as flat per day
        taxAmount = config.rate_value * numberOfDays;
        description = `$${config.rate_value}/vehicle × ${numberOfDays} days`;
        break;
        
      default:
        console.warn(`Unknown tax calculation type: ${config.calculation_type}`);
        continue;
    }
    
    // Round to 2 decimal places
    taxAmount = Math.round(taxAmount * 100) / 100;
    
    calculatedTaxes.push({
      taxAccountId: config.tax_account_id,
      taxAccountCode: config.tax_account?.code || "",
      taxAccountName: config.tax_account?.name || "",
      calculationType: config.calculation_type,
      rateValue: config.rate_value,
      calculatedAmount: taxAmount,
      description,
    });
  }
  
  return calculatedTaxes;
}

/**
 * Gets the net revenue amount after extracting VAT-inclusive taxes
 */
export function getNetRevenueAmount(
  grossAmount: number,
  taxConfigs: TaxConfig[]
): number {
  let netAmount = grossAmount;
  
  for (const config of taxConfigs) {
    if (config.calculation_type === "vat_inclusive" || config.calculation_type === "vat") {
      const vatAmount = grossAmount * (config.rate_value / (100 + config.rate_value));
      netAmount -= vatAmount;
    }
  }
  
  return Math.round(netAmount * 100) / 100;
}

/**
 * Calculates total tax amount from calculated taxes
 */
export function getTotalTaxAmount(calculatedTaxes: CalculatedTax[]): number {
  return calculatedTaxes.reduce((sum, tax) => sum + tax.calculatedAmount, 0);
}

/**
 * Creates journal entry lines for taxes
 * Debits receivable/revenue offset, credits tax liability accounts
 */
export function createTaxJournalLines(
  calculatedTaxes: CalculatedTax[],
  receivableAccountId: string
): { accountId: string; debit: number; credit: number; description: string }[] {
  const lines: { accountId: string; debit: number; credit: number; description: string }[] = [];
  
  for (const tax of calculatedTaxes) {
    if (tax.calculatedAmount > 0) {
      // Credit the tax liability account
      lines.push({
        accountId: tax.taxAccountId,
        debit: 0,
        credit: tax.calculatedAmount,
        description: tax.description,
      });
    }
  }
  
  // Debit the receivable for total tax amount
  const totalTax = getTotalTaxAmount(calculatedTaxes);
  if (totalTax > 0) {
    lines.push({
      accountId: receivableAccountId,
      debit: totalTax,
      credit: 0,
      description: "Tax charges",
    });
  }
  
  return lines;
}
