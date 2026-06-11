import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MobileSheet } from './MobileExtras';
import { Icon } from './Icon';
import { THEME } from '../theme';
import { parseEpcQr, type EpcPayment } from '../lib/epc';

// Scan-to-pay sheet (#43): reads EPC069-12 SEPA QR codes (the format
// Payconiq-class apps emit) and hands the parsed payment to the caller.
export function QrScanSheet({ open, onClose, onScanned }: {
  open: boolean;
  onClose: () => void;
  onScanned: (p: EpcPayment) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const lastRejectRef = useRef(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (open) {
      setError('');
      doneRef.current = false;
      if (permission && !permission.granted && permission.canAskAgain) requestPermission();
    }
  }, [open]);

  const handleScan = ({ data }: { data: string }) => {
    if (doneRef.current) return;
    const payment = parseEpcQr(data);
    if (payment) {
      doneRef.current = true; // the camera keeps firing — accept only once
      onScanned(payment);
      onClose();
    } else if (Date.now() - lastRejectRef.current > 1500) {
      lastRejectRef.current = Date.now();
      setError('That QR is not a SEPA payment code.');
    }
  };

  return (
    <MobileSheet open={open} onClose={onClose} title="Scan a payment QR">
      <View style={{ gap: 14 }}>
        {!permission?.granted ? (
          <View style={{ alignItems: 'center', gap: 14, paddingVertical: 24 }}>
            <Icon name="card" size={32} color={THEME.colors.text3} />
            <Text style={{ color: THEME.colors.text2, fontSize: 14, textAlign: 'center' }}>
              Camera access is needed to scan payment QR codes.
            </Text>
            <TouchableOpacity
              onPress={requestPermission}
              accessibilityRole="button"
              style={{ backgroundColor: THEME.colors.accent, paddingVertical: 12, paddingHorizontal: 22, borderRadius: THEME.radius.regular }}
            >
              <Text style={{ color: THEME.colors.onAccent, fontWeight: '700' }}>Allow camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={{ height: 320, borderRadius: THEME.radius.lg, overflow: 'hidden', backgroundColor: '#000' }}>
              <CameraView
                style={{ flex: 1 }}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleScan}
              />
            </View>
            <Text style={{ color: error ? THEME.colors.warn : THEME.colors.text3, fontSize: 13, textAlign: 'center' }}>
              {error || 'Point the camera at a Payconiq-style SEPA QR code.'}
            </Text>
          </>
        )}
      </View>
    </MobileSheet>
  );
}
