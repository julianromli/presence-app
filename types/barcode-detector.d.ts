declare type BarcodeFormat = 'qr_code';

declare type DetectedBarcode = {
  rawValue?: string;
};

declare class BarcodeDetector {
  constructor(options?: { formats?: BarcodeFormat[] });
  detect(image: ImageBitmapSource): Promise<DetectedBarcode[]>;
}
