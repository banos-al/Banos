/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface OCRScanResult {
  hosp_invoice: string;
  manifest_code: string;
  date: string;
  sender: string;
  recipient: string;
  logistics_courier: string;
  confidence_score: number;
  notes: string;
}

export interface ExcelRow {
  id: string; // Unique Row identifier
  scan_timestamp: string; // Log of when scanned
  filename: string; // Log of filename/source identifier
  image_base64: string; // Keeps the base64 crop or capture for split-screen inspection!
  hosp_invoice: string; // High Accuracy Hospital Invoice Number (Nomor Hosp. Invoice)
  manifest_code: string; // High Accuracy Shipping Manifest / Tracking Code
  date: string; // Shipping Document Date
  sender: string; // Dispatcher Company/Name
  recipient: string; // Destination Consignee/Address
  logistics_courier: string; // Courier Service Name (JNE, J&T, Sicepat, etc.)
  confidence_score: number; // Reliability Index [0-100]
  notes: string; // Diagnostic remarks
  is_verified: boolean; // Operator verification flag
}
