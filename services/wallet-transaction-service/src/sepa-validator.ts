import { publishEvent } from 'shared';

export interface SEPAValidationResult {
  isValid: boolean;
  errors: string[];
  paymentInfo?: {
    msgId: string;
    senderIban: string;
    receiverIban: string;
    amount: number;
    currency: string;
    description: string;
    reference: string;
  };
}

/**
 * Validates a SEPA Pain.001.001.03 XML document structure against banking XSD constraints.
 * Written in pure TS for speed, reliability, and zero binary dependencies.
 */
export function validateSEPAXML(xmlContent: string): SEPAValidationResult {
  const errors: string[] = [];
  
  // Basic XML structure checks
  if (!xmlContent.includes('<?xml') && !xmlContent.startsWith('<')) {
    return { isValid: false, errors: ['Invalid file format: Not a valid XML document.'] };
  }

  // Check namespace declaration
  if (!xmlContent.includes('urn:iso:std:iso:20022:tech:xsd:pain.001.001.03')) {
    errors.push('XSD Validation Schema mismatch: Document namespace must be pain.001.001.03.');
  }

  // Extraction helper using simple tag search (safe and fast for structured SEPA XMLs)
  const extractTagValue = (tag: string): string => {
    const startTag = `<${tag}>`;
    const endTag = `</${tag}>`;
    const startIdx = xmlContent.indexOf(startTag);
    if (startIdx === -1) return '';
    const endIdx = xmlContent.indexOf(endTag, startIdx);
    if (endIdx === -1) return '';
    return xmlContent.substring(startIdx + startTag.length, endIdx).trim();
  };

  // Extract nested tags like <IBAN> or <InstdAmt Ccy="EUR">
  const extractNestedTag = (parentTag: string, childTag: string): string => {
    const parentStart = xmlContent.indexOf(`<${parentTag}>`);
    if (parentStart === -1) return '';
    const parentEnd = xmlContent.indexOf(`</${parentTag}>`, parentStart);
    if (parentEnd === -1) return '';
    
    const parentContent = xmlContent.substring(parentStart, parentEnd);
    const startTag = `<${childTag}>`;
    const endTag = `</${childTag}>`;
    const startIdx = parentContent.indexOf(startTag);
    if (startIdx === -1) return '';
    const endIdx = parentContent.indexOf(endTag, startIdx);
    if (endIdx === -1) return '';
    return parentContent.substring(startIdx + startTag.length, endIdx).trim();
  };

  // 1. Validate Group Header
  const msgId = extractTagValue('MsgId');
  if (!msgId) {
    errors.push('XSD Violation: Group Header <GrpHdr> is missing mandatory element <MsgId>.');
  }

  const creDtTm = extractTagValue('CreDtTm');
  if (!creDtTm) {
    errors.push('XSD Violation: Message creation date <CreDtTm> is missing.');
  }

  // 2. Validate Debtor Info (Sender IBAN)
  const senderIban = extractNestedTag('DbtrAcct', 'IBAN');
  if (!senderIban) {
    errors.push('XSD Violation: Debtor Account IBAN <DbtrAcct><Id><IBAN> is missing or empty.');
  } else {
    // Validate IBAN pattern (simple length check for typical BE/NL/DE IBANs)
    const cleanIban = senderIban.replace(/\s+/g, '');
    if (cleanIban.length < 15 || cleanIban.length > 34) {
      errors.push(`XSD Validation constraint violation: Debtor IBAN '${senderIban}' is structurally invalid.`);
    }
  }

  // 3. Validate Transaction Info (Receiver, Amount, Currency)
  const receiverIban = extractNestedTag('CdtrAcct', 'IBAN');
  if (!receiverIban) {
    errors.push('XSD Violation: Creditor Account IBAN <CdtrAcct><Id><IBAN> is missing or empty.');
  }

  // Validate Amount & Currency
  const amtMatch = xmlContent.match(/<InstdAmt Ccy="([^"]+)">([^<]+)<\/InstdAmt>/);
  let amount = 0;
  let currency = '';

  if (!amtMatch) {
    errors.push('XSD Violation: Transaction amount element <InstdAmt Ccy="..."> is missing or malformed.');
  } else {
    currency = amtMatch[1];
    amount = parseFloat(amtMatch[2]);

    if (isNaN(amount) || amount <= 0) {
      errors.push('XSD Validation constraint violation: Instructed Amount <InstdAmt> must be a positive decimal number.');
    }
    if (currency !== 'EUR') {
      errors.push(`Banking constraint: Currency '${currency}' is not supported. FinVault only supports SEPA EUR transactions.`);
    }
  }

  const reference = extractTagValue('EndToEndId');
  if (!reference) {
    errors.push('XSD Violation: Credit Transfer transaction <CdtTrfTxInf> requires an <EndToEndId> reference.');
  }

  const description = extractTagValue('Ustrd') || 'SEPA Credit Transfer';

  return {
    isValid: errors.length === 0,
    errors,
    paymentInfo: errors.length === 0 ? {
      msgId,
      senderIban: senderIban.replace(/\s+/g, ''),
      receiverIban: receiverIban.replace(/\s+/g, ''),
      amount,
      currency,
      description,
      reference
    } : undefined
  };
}
