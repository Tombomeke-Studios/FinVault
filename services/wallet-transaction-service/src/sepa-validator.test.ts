import { describe, it, expect } from 'vitest';
import { validateSEPAXML } from './sepa-validator.js';

describe('SEPA XML Pain.001 Validator', () => {
  const validSEPAXML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>MSG8847120</MsgId>
      <CreDtTm>2026-05-30T19:50:56Z</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <InitgPty><Nm>Tom Bomeke</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT7412</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <Dbtr><Nm>Tom Bomeke</Nm></Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>BE8937700771994821</IBAN>
        </Id>
      </DbtrAcct>
      <CdtTrfTxInf>
        <PmtId>
          <EndToEndId>REF28401</EndToEndId>
        </PmtId>
        <Amt>
          <InstdAmt Ccy="EUR">320.50</InstdAmt>
        </Amt>
        <Cdtr><Nm>Recipient Name</Nm></Cdtr>
        <CdtrAcct>
          <Id>
            <IBAN>BE9631007412345678</IBAN>
          </Id>
        </CdtrAcct>
        <RmtInf>
          <Ustrd>Invoicing for consultancy</Ustrd>
        </RmtInf>
      </CdtTrfTxInf>
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`;

  it('should successfully validate a structurally correct SEPA Pain.001 XML file', () => {
    const result = validateSEPAXML(validSEPAXML);

    expect(result.isValid).toBe(true);
    expect(result.errors.length).toBe(0);
    expect(result.paymentInfo).toBeDefined();
    
    const info = result.paymentInfo!;
    expect(info.msgId).toBe('MSG8847120');
    expect(info.senderIban).toBe('BE8937700771994821');
    expect(info.receiverIban).toBe('BE9631007412345678');
    expect(info.amount).toBe(320.50);
    expect(info.currency).toBe('EUR');
    expect(info.reference).toBe('REF28401');
    expect(info.description).toBe('Invoicing for consultancy');
  });

  it('should fail if the namespace is not pain.001.001.03', () => {
    const malformedNamespace = validSEPAXML.replace(
      'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03',
      'urn:iso:std:iso:20022:tech:xsd:pain.008.001.02' // direct debit schema
    );

    const result = validateSEPAXML(malformedNamespace);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('XSD Validation Schema mismatch: Document namespace must be pain.001.001.03.');
  });

  it('should fail validation when Instructed Amount is zero or negative', () => {
    const zeroAmountXML = validSEPAXML.replace(
      '<InstdAmt Ccy="EUR">320.50</InstdAmt>',
      '<InstdAmt Ccy="EUR">-50.00</InstdAmt>'
    );

    const result = validateSEPAXML(zeroAmountXML);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('XSD Validation constraint violation: Instructed Amount <InstdAmt> must be a positive decimal number.');
  });

  it('should fail when Debtor IBAN is missing', () => {
    const missingIbanXML = validSEPAXML.replace(
      '<IBAN>BE8937700771994821</IBAN>',
      ''
    );

    const result = validateSEPAXML(missingIbanXML);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('XSD Violation: Debtor Account IBAN <DbtrAcct><Id><IBAN> is missing or empty.');
  });
});
