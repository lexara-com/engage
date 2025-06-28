// HIPAA-compliant encryption utilities for Engage
// Uses Web Crypto API (available in Cloudflare Workers) for AES-256-GCM encryption

import { createLogger } from '@/utils/logger';

// Logger will be initialized per-request with proper environment context

// Encryption result interface
export interface EncryptionResult {
  encryptedData: string;        // Base64 encoded
  iv: string;                   // Base64 encoded initialization vector
  authTag: string;              // Base64 encoded authentication tag
  algorithm: 'AES-256-GCM';
  keyId: string;                // Reference to encryption key
}

// Decryption parameters
export interface DecryptionParams {
  encryptedData: string;
  iv: string;
  authTag: string;
  algorithm: 'AES-256-GCM';
  keyId: string;
}

// Data classification for HIPAA compliance
export interface DataClassification {
  containsPII: boolean;         // Personally Identifiable Information
  containsePHI: boolean;        // Electronic Protected Health Information
  containsMedicalInfo: boolean; // Medical conditions, treatments, etc.
  sensitivityLevel: 'public' | 'internal' | 'confidential' | 'restricted';
  requiresEncryption: boolean;
}

// Utility functions for array buffer conversion
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Main encryption class
export class HIPAAEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12; // 96 bits for GCM

  // Generate a new AES-256 encryption key
  static async generateKey(): Promise<CryptoKey> {
    try {
      const key = await crypto.subtle.generateKey(
        {
          name: this.ALGORITHM,
          length: this.KEY_LENGTH,
        },
        true, // extractable
        ['encrypt', 'decrypt']
      );
      
      logger.info('Generated new AES-256 encryption key');
      return key;
    } catch (error) {
      logger.error('Failed to generate encryption key', { error: error.message });
      throw new Error('Encryption key generation failed');
    }
  }

  // Export key for storage (encrypted with master key)
  static async exportKey(key: CryptoKey): Promise<string> {
    try {
      const exported = await crypto.subtle.exportKey('raw', key);
      return arrayBufferToBase64(exported);
    } catch (error) {
      logger.error('Failed to export encryption key', { error: error.message });
      throw new Error('Key export failed');
    }
  }

  // Import key from storage
  static async importKey(keyData: string): Promise<CryptoKey> {
    try {
      const keyBuffer = base64ToArrayBuffer(keyData);
      const key = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        {
          name: this.ALGORITHM,
          length: this.KEY_LENGTH,
        },
        true,
        ['encrypt', 'decrypt']
      );
      
      return key;
    } catch (error) {
      logger.error('Failed to import encryption key', { error: error.message });
      throw new Error('Key import failed');
    }
  }

  // Encrypt data with AES-256-GCM
  static async encrypt(
    plaintext: string,
    key: CryptoKey,
    keyId: string
  ): Promise<EncryptionResult> {
    try {
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      
      // Encode plaintext
      const encodedData = new TextEncoder().encode(plaintext);
      
      // Encrypt
      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        key,
        encodedData
      );
      
      // Split encrypted data and auth tag
      const encryptedBytes = new Uint8Array(encrypted);
      const dataLength = encryptedBytes.length - 16; // GCM auth tag is 16 bytes
      const encryptedData = encryptedBytes.slice(0, dataLength);
      const authTag = encryptedBytes.slice(dataLength);
      
      const result: EncryptionResult = {
        encryptedData: arrayBufferToBase64(encryptedData),
        iv: arrayBufferToBase64(iv),
        authTag: arrayBufferToBase64(authTag),
        algorithm: 'AES-256-GCM',
        keyId
      };
      
      logger.info('Data encrypted successfully', { 
        keyId, 
        dataLength: plaintext.length,
        encryptedLength: result.encryptedData.length 
      });
      
      return result;
    } catch (error) {
      logger.error('Encryption failed', { error: error.message, keyId });
      throw new Error('Data encryption failed');
    }
  }

  // Decrypt data
  static async decrypt(
    params: DecryptionParams,
    key: CryptoKey
  ): Promise<string> {
    try {
      // Reconstruct encrypted data with auth tag
      const encryptedData = base64ToArrayBuffer(params.encryptedData);
      const authTag = base64ToArrayBuffer(params.authTag);
      const iv = base64ToArrayBuffer(params.iv);
      
      // Combine encrypted data and auth tag
      const combined = new Uint8Array(encryptedData.byteLength + authTag.byteLength);
      combined.set(new Uint8Array(encryptedData), 0);
      combined.set(new Uint8Array(authTag), encryptedData.byteLength);
      
      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: iv,
        },
        key,
        combined
      );
      
      // Decode result
      const plaintext = new TextDecoder().decode(decrypted);
      
      logger.info('Data decrypted successfully', { 
        keyId: params.keyId,
        decryptedLength: plaintext.length 
      });
      
      return plaintext;
    } catch (error) {
      logger.error('Decryption failed', { 
        error: error.message, 
        keyId: params.keyId 
      });
      throw new Error('Data decryption failed');
    }
  }

  // Classify data for HIPAA compliance
  static classifyData(content: string): DataClassification {
    const lowerContent = content.toLowerCase();
    
    // PII patterns
    const piiPatterns = [
      /\b\d{3}-\d{2}-\d{4}\b/,           // SSN
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,   // Phone number
      /\b\d{1,5}\s+[A-Za-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|circle|cir|place|pl)\b/i // Address
    ];
    
    // ePHI/Medical patterns
    const medicalPatterns = [
      /\b(?:doctor|dr\.?|physician|hospital|clinic|medical|medicine|treatment|diagnosis|condition|injury|pain|surgery|prescription|medication|therapy|rehabilitation)\b/i,
      /\b(?:mri|ct scan|x-ray|blood test|lab results|medical records|health insurance|medicare|medicaid)\b/i,
      /\b(?:diabetes|cancer|heart disease|depression|anxiety|adhd|ptsd|broken bone|fracture|concussion|herniated disc)\b/i,
      /\b(?:back pain|neck pain|headache|migraine|chronic pain|acute pain|injury|trauma|accident)\b/i,
      /\b(?:L\d+-L\d+|C\d+-C\d+|T\d+-T\d+)\b/, // Spinal vertebrae references
      /\b(?:icd-?\d+|cpt-?\d+)\b/i,            // Medical codes
    ];
    
    const containsPII = piiPatterns.some(pattern => pattern.test(content));
    const containsMedicalInfo = medicalPatterns.some(pattern => pattern.test(lowerContent));
    
    // ePHI is PII + medical information
    const containsePHI = containsPII && containsMedicalInfo;
    
    // Determine sensitivity level
    let sensitivityLevel: DataClassification['sensitivityLevel'] = 'internal';
    if (containsePHI) {
      sensitivityLevel = 'restricted';
    } else if (containsPII || containsMedicalInfo) {
      sensitivityLevel = 'confidential';
    }
    
    const requiresEncryption = containsPII || containsMedicalInfo || containsePHI;
    
    return {
      containsPII,
      containsePHI,
      containsMedicalInfo,
      sensitivityLevel,
      requiresEncryption
    };
  }

  // Create hash for data integrity verification
  static async createIntegrityHash(data: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
      return arrayBufferToBase64(hashBuffer);
    } catch (error) {
      logger.error('Hash creation failed', { error: error.message });
      throw new Error('Integrity hash creation failed');
    }
  }

  // Verify data integrity
  static async verifyIntegrity(data: string, expectedHash: string): Promise<boolean> {
    try {
      const actualHash = await this.createIntegrityHash(data);
      return actualHash === expectedHash;
    } catch (error) {
      logger.error('Integrity verification failed', { error: error.message });
      return false;
    }
  }
}

// Key management for firms
export class FirmKeyManager {
  private static readonly KEY_ROTATION_DAYS = 90;
  
  // Generate firm-specific encryption key
  static async generateFirmKey(firmId: string): Promise<{
    keyId: string;
    key: CryptoKey;
    metadata: KeyMetadata;
  }> {
    const keyId = `${firmId}_${Date.now()}_${crypto.randomUUID()}`;
    const key = await HIPAAEncryption.generateKey();
    
    const metadata: KeyMetadata = {
      keyId,
      firmId,
      purpose: 'conversation_encryption',
      createdAt: new Date(),
      rotationDue: new Date(Date.now() + this.KEY_ROTATION_DAYS * 24 * 60 * 60 * 1000),
      algorithm: 'AES-256-GCM',
      status: 'active'
    };
    
    logger.info('Generated firm encryption key', { firmId, keyId });
    
    return { keyId, key, metadata };
  }
  
  // Check if key rotation is needed
  static needsRotation(metadata: KeyMetadata): boolean {
    return new Date() >= metadata.rotationDue;
  }
}

// Key metadata interface
export interface KeyMetadata {
  keyId: string;
  firmId: string;
  purpose: 'conversation_encryption' | 'pii_encryption' | 'medical_encryption';
  createdAt: Date;
  rotationDue: Date;
  algorithm: 'AES-256-GCM';
  status: 'active' | 'rotating' | 'deprecated' | 'revoked';
}

// Enhanced user identity with encryption
export interface EncryptedUserIdentity {
  // Safe fields (unencrypted)
  legalArea?: string;
  basicSituation?: string;          // Sanitized version without PII/ePHI
  
  // Encrypted PII/ePHI fields
  encryptedName?: EncryptionResult;
  encryptedEmail?: EncryptionResult;
  encryptedPhone?: EncryptionResult;
  encryptedAddress?: EncryptionResult;
  encryptedMedicalInfo?: EncryptionResult;
  encryptedDetailedSituation?: EncryptionResult;
  
  // Encryption metadata
  encryptionKeyId: string;
  classificationLevel: DataClassification['sensitivityLevel'];
  lastEncrypted: Date;
}

// Encrypted message interface
export interface EncryptedMessage {
  id: string;
  role: 'user' | 'agent';
  
  // Content handling
  content?: string;                 // Plain text (if not sensitive)
  encryptedContent?: EncryptionResult; // Encrypted content (if sensitive)
  isEncrypted: boolean;
  
  // Metadata
  timestamp: Date;
  classification: DataClassification;
  integrityHash: string;
  
  // Audit trail
  encryptedBy?: string;             // System or user ID
  encryptionTimestamp?: Date;
}