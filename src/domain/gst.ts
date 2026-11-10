/**
 * 18% GST SAC 999293 Reverse Split Engine
 * File: src/domain/gst.ts
 *
 * Statutory Reference:
 * - GST Act & Rajasthan SGST Act: SAC 999293 (Coaching Services)
 * - 18% inclusive reverse tax split: 9% CGST + 9% SGST (or 18% IGST for interstate)
 * - Exact integer paise formula: T = floor((18 * G + 118) / 236)
 * - Invariant: CGST === SGST === T, Taxable === G - 2*T, Taxable + CGST + SGST === G
 */

export interface GstSplit {
  grossPaise: bigint;
  taxablePaise: bigint;
  cgstPaise: bigint;
  sgstPaise: bigint;
  igstPaise: bigint;
  totalTaxPaise: bigint;
  rateBasisPoints: number; // 1800 = 18.00%
  sacCode: string; // '999293'
  isInterState: boolean;
}

export interface FormattedGstSplit {
  gross: string;
  taxable: string;
  cgst: string;
  sgst: string;
  igst: string;
  totalTax: string;
}

/**
 * Calculates 18% GST reverse split on gross tax-inclusive amount in integer paise.
 *
 * Formula:
 * For intra-state (Rajasthan):
 *   T = round_half_up(9 * G / 118) = floor((18 * G + 118) / 236)
 *   CGST = T
 *   SGST = T
 *   Taxable = G - 2 * T
 *
 * For inter-state (IGST 18%):
 *   T_igst = round_half_up(18 * G / 118) = floor((36 * G + 118) / 236)
 *   IGST = T_igst
 *   CGST = 0
 *   SGST = 0
 *   Taxable = G - T_igst
 */
export function calculateGstReverseSplit(
  grossPaise: bigint,
  isInterState: boolean = false
): GstSplit {
  if (grossPaise < 0n) {
    throw new RangeError('Gross amount cannot be negative');
  }

  if (grossPaise === 0n) {
    return {
      grossPaise: 0n,
      taxablePaise: 0n,
      cgstPaise: 0n,
      sgstPaise: 0n,
      igstPaise: 0n,
      totalTaxPaise: 0n,
      rateBasisPoints: 1800,
      sacCode: '999293',
      isInterState,
    };
  }

  if (isInterState) {
    // Inter-state: 18% IGST
    const igst = (36n * grossPaise + 118n) / 236n;
    const taxable = grossPaise - igst;
    return {
      grossPaise,
      taxablePaise: taxable,
      cgstPaise: 0n,
      sgstPaise: 0n,
      igstPaise: igst,
      totalTaxPaise: igst,
      rateBasisPoints: 1800,
      sacCode: '999293',
      isInterState: true,
    };
  }

  // Intra-state (Rajasthan): 9% CGST + 9% SGST
  const t = (18n * grossPaise + 118n) / 236n;
  const taxable = grossPaise - 2n * t;

  return {
    grossPaise,
    taxablePaise: taxable,
    cgstPaise: t,
    sgstPaise: t,
    igstPaise: 0n,
    totalTaxPaise: 2n * t,
    rateBasisPoints: 1800,
    sacCode: '999293',
    isInterState: false,
  };
}

/**
 * Formats integer paise into Indian Rupee decimal string (e.g. 1271186n -> "12711.86")
 */
export function formatPaiseToRupees(paise: bigint): string {
  const isNegative = paise < 0n;
  const absPaise = isNegative ? -paise : paise;
  const rupees = absPaise / 100n;
  const remainder = absPaise % 100n;
  const formatted = `${rupees.toString()}.${remainder.toString().padStart(2, '0')}`;
  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Formats integer paise into Indian Rupee formatted with commas (e.g. 1500000n -> "₹15,000.00")
 */
export function formatPaiseToCurrency(paise: bigint, includeSymbol = true): string {
  const isNegative = paise < 0n;
  const absPaise = isNegative ? -paise : paise;
  const rupees = Number(absPaise / 100n);
  const remainder = Number(absPaise % 100n);
  const formattedRupees = rupees.toLocaleString('en-IN');
  const formattedDecimal = remainder.toString().padStart(2, '0');
  const prefix = isNegative ? '-₹' : includeSymbol ? '₹' : '';
  return `${prefix}${formattedRupees}.${formattedDecimal}`;
}

/**
 * Formats a GST split into human-readable rupee strings
 */
export function formatGstSplit(split: GstSplit): FormattedGstSplit {
  return {
    gross: formatPaiseToRupees(split.grossPaise),
    taxable: formatPaiseToRupees(split.taxablePaise),
    cgst: formatPaiseToRupees(split.cgstPaise),
    sgst: formatPaiseToRupees(split.sgstPaise),
    igst: formatPaiseToRupees(split.igstPaise),
    totalTax: formatPaiseToRupees(split.totalTaxPaise),
  };
}
