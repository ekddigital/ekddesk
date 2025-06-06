import * as crypto from 'crypto';
import * as forge from 'node-forge';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '@ekd-desk/shared';
import { Certificate, CertificateFormat, CertificateType, CertificateError } from './types';

/**
 * Certificate manager for EKD Desk
 * Handles SSL/TLS certificate generation, management, and validation
 */
export class CertificateManager {
  private logger: Logger;
  private certificates: Map<string, Certificate> = new Map();
  private caPrivateKey: forge.pki.PrivateKey | null = null;
  private caCertificate: forge.pki.Certificate | null = null;

  constructor() {
    this.logger = Logger.createLogger('CertificateManager');
  }

  /**
   * Initialize CA (Certificate Authority)
   */
  async initializeCA(
    commonName: string = 'EKD Desk CA',
    organizationName: string = 'EKD Technologies',
    validityDays: number = 3650 // 10 years
  ): Promise<Certificate> {
    // If CA is already initialized, return existing certificate
    if (this.caCertificate && this.caPrivateKey) {
      const existingCert = Array.from(this.certificates.values()).find(cert => cert.type === 'ca');
      if (existingCert) {
        this.logger.info('CA already initialized, returning existing certificate');
        return existingCert;
      }
    }

    try {
      // Generate CA key pair
      const caKeyPair = forge.pki.rsa.generateKeyPair(2048);
      this.caPrivateKey = caKeyPair.privateKey;
      
      // Create CA certificate
      this.caCertificate = forge.pki.createCertificate();
      this.caCertificate.publicKey = caKeyPair.publicKey;
      this.caCertificate.serialNumber = '01';
      this.caCertificate.validity.notBefore = new Date();
      this.caCertificate.validity.notAfter = new Date();
      this.caCertificate.validity.notAfter.setDate(
        this.caCertificate.validity.notBefore.getDate() + validityDays
      );

      // Set CA subject
      const caSubject = [
        { name: 'commonName', value: commonName },
        { name: 'organizationName', value: organizationName },
        { name: 'countryName', value: 'US' }
      ];
      this.caCertificate.setSubject(caSubject);
      this.caCertificate.setIssuer(caSubject);

      // Add extensions
      this.caCertificate.setExtensions([
        {
          name: 'basicConstraints',
          cA: true,
          critical: true
        },
        {
          name: 'keyUsage',
          keyCertSign: true,
          cRLSign: true,
          critical: true
        }
      ]);      // Self-sign the CA certificate
      this.caCertificate.sign(this.caPrivateKey, forge.md.sha256.create());
      
      const certificate: Certificate = {
        certificate: forge.pki.certificateToPem(this.caCertificate),
        privateKey: forge.pki.privateKeyToPem(this.caPrivateKey),
        publicKey: forge.pki.publicKeyToPem(this.caCertificate.publicKey),
        subject: commonName,
        issuer: commonName,
        serialNumber: this.caCertificate.serialNumber,
        notBefore: this.caCertificate.validity.notBefore,
        notAfter: this.caCertificate.validity.notAfter,
        fingerprint: this.calculateFingerprint(this.caCertificate),
        format: 'pem',
        type: 'ca'
      };

      const certId = uuidv4();
      this.certificates.set(certId, certificate);
      
      this.logger.info('CA initialized', { commonName, certId });
      return certificate;    } catch (error) {
      this.logger.error('CA initialization failed', error);
      throw new CertificateError('CA initialization failed', { error });
    }
  }

  /**
   * Generate a server certificate signed by CA
   */
  async generateServerCertificate(
    commonName: string,
    organizationName: string = 'EKD Technologies',
    subjectAltNames: string[] = [],
    validityDays: number = 365
  ): Promise<Certificate> {
    try {
      if (!this.caCertificate || !this.caPrivateKey) {
        throw new CertificateError('CA not initialized. Call initializeCA() first.');
      }

      // Generate key pair for server certificate
      const keyPair = forge.pki.rsa.generateKeyPair(2048);
      
      // Create server certificate
      const cert = forge.pki.createCertificate();
      cert.publicKey = keyPair.publicKey;
      cert.serialNumber = this.generateSerialNumber();
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + validityDays);

      // Set subject
      const subject = [
        { name: 'commonName', value: commonName },
        { name: 'organizationName', value: organizationName },
        { name: 'countryName', value: 'US' }
      ];
      cert.setSubject(subject);
      cert.setIssuer(this.caCertificate.subject.attributes);

      // Add extensions
      const extensions = [
        {
          name: 'basicConstraints',
          cA: false,
          critical: true
        },
        {
          name: 'keyUsage',
          digitalSignature: true,
          keyEncipherment: true,
          critical: true
        },
        {
          name: 'extKeyUsage',
          serverAuth: true,
          clientAuth: true
        }
      ];

      // Add Subject Alternative Names if provided
      if (subjectAltNames.length > 0) {
        const altNames = subjectAltNames.map(name => ({
          type: name.includes('.') ? 2 : 7, // DNS name or IP
          value: name
        }));

        extensions.push({
          name: 'subjectAltName',
          altNames
        } as any);
      }

      cert.setExtensions(extensions);      // Sign with CA private key
      cert.sign(this.caPrivateKey, forge.md.sha256.create());

      const certificate: Certificate = {
        certificate: forge.pki.certificateToPem(cert),
        privateKey: forge.pki.privateKeyToPem(keyPair.privateKey),
        publicKey: forge.pki.publicKeyToPem(keyPair.publicKey),
        subject: commonName,
        issuer: this.caCertificate.subject.getField('CN')?.value || 'Unknown',
        serialNumber: cert.serialNumber,
        notBefore: cert.validity.notBefore,
        notAfter: cert.validity.notAfter,
        fingerprint: this.calculateFingerprint(cert),
        format: 'pem',
        type: 'server'
      };

      const certId = uuidv4();
      this.certificates.set(certId, certificate);
      
      this.logger.info('Server certificate generated', { commonName, certId });
      return certificate;
    } catch (error) {
      this.logger.error('Server certificate generation failed', error);
      throw new CertificateError('Server certificate generation failed', { error });
    }
  }

  /**
   * Generate a client certificate
   */
  async generateClientCertificate(
    commonName: string,
    emailAddress: string,
    organizationName: string = 'EKD Technologies',
    validityDays: number = 365
  ): Promise<Certificate> {
    try {
      if (!this.caCertificate || !this.caPrivateKey) {
        throw new CertificateError('CA not initialized. Call initializeCA() first.');
      }

      // Generate key pair for client certificate
      const keyPair = forge.pki.rsa.generateKeyPair(2048);
      
      // Create client certificate
      const cert = forge.pki.createCertificate();
      cert.publicKey = keyPair.publicKey;
      cert.serialNumber = this.generateSerialNumber();
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + validityDays);

      // Set subject
      const subject = [
        { name: 'commonName', value: commonName },
        { name: 'emailAddress', value: emailAddress },
        { name: 'organizationName', value: organizationName },
        { name: 'countryName', value: 'US' }
      ];
      cert.setSubject(subject);
      cert.setIssuer(this.caCertificate.subject.attributes);

      // Add extensions
      cert.setExtensions([
        {
          name: 'basicConstraints',
          cA: false,
          critical: true
        },
        {
          name: 'keyUsage',
          digitalSignature: true,
          keyEncipherment: true,
          critical: true
        },
        {
          name: 'extKeyUsage',
          clientAuth: true,
          emailProtection: true
        }
      ]);      // Sign with CA private key
      cert.sign(this.caPrivateKey, forge.md.sha256.create());

      const certificate: Certificate = {
        certificate: forge.pki.certificateToPem(cert),
        privateKey: forge.pki.privateKeyToPem(keyPair.privateKey),
        publicKey: forge.pki.publicKeyToPem(keyPair.publicKey),
        subject: commonName,
        issuer: this.caCertificate.subject.getField('CN')?.value || 'Unknown',
        serialNumber: cert.serialNumber,
        notBefore: cert.validity.notBefore,
        notAfter: cert.validity.notAfter,
        fingerprint: this.calculateFingerprint(cert),
        format: 'pem',
        type: 'client'
      };

      const certId = uuidv4();
      this.certificates.set(certId, certificate);
      
      this.logger.info('Client certificate generated', { commonName, certId });
      return certificate;
    } catch (error) {
      this.logger.error('Client certificate generation failed', error);
      throw new CertificateError('Client certificate generation failed', { error });
    }
  }

  /**
   * Generate self-signed certificate
   */
  async generateSelfSignedCertificate(
    commonName: string,
    organizationName: string = 'EKD Technologies',
    validityDays: number = 365
  ): Promise<Certificate> {
    try {
      // Generate key pair
      const keyPair = forge.pki.rsa.generateKeyPair(2048);
      
      // Create certificate
      const cert = forge.pki.createCertificate();
      cert.publicKey = keyPair.publicKey;
      cert.serialNumber = this.generateSerialNumber();
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setDate(cert.validity.notBefore.getDate() + validityDays);

      // Set subject and issuer (same for self-signed)
      const subject = [
        { name: 'commonName', value: commonName },
        { name: 'organizationName', value: organizationName },
        { name: 'countryName', value: 'US' }
      ];
      cert.setSubject(subject);
      cert.setIssuer(subject);

      // Add extensions
      cert.setExtensions([
        {
          name: 'basicConstraints',
          cA: false
        },
        {
          name: 'keyUsage',
          digitalSignature: true,
          keyEncipherment: true
        },
        {
          name: 'extKeyUsage',
          serverAuth: true,
          clientAuth: true
        }
      ]);

      // Self-sign the certificate
      cert.sign(keyPair.privateKey, forge.md.sha256.create());

      const certificate: Certificate = {
        certificate: forge.pki.certificateToPem(cert),
        privateKey: forge.pki.privateKeyToPem(keyPair.privateKey),
        publicKey: forge.pki.publicKeyToPem(keyPair.publicKey),
        subject: commonName,
        issuer: commonName,
        serialNumber: cert.serialNumber,
        notBefore: cert.validity.notBefore,
        notAfter: cert.validity.notAfter,
        fingerprint: this.calculateFingerprint(cert),
        format: 'pem',
        type: 'self-signed'
      };

      const certId = uuidv4();
      this.certificates.set(certId, certificate);
      
      this.logger.info('Self-signed certificate generated', { commonName, certId });
      return certificate;
    } catch (error) {
      this.logger.error('Self-signed certificate generation failed', error);
      throw new CertificateError('Self-signed certificate generation failed', { error });
    }
  }

  /**
   * Validate certificate
   */
  validateCertificate(certificate: Certificate): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      const cert = forge.pki.certificateFromPem(certificate.certificate);
      const now = new Date();

      // Check validity period
      if (cert.validity.notBefore > now) {
        errors.push('Certificate is not yet valid');
      }
      if (cert.validity.notAfter < now) {
        errors.push('Certificate has expired');
      }

      // Check if certificate will expire soon (within 30 days)
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (cert.validity.notAfter < thirtyDaysFromNow) {
        warnings.push('Certificate will expire within 30 days');
      }

      // Verify signature if CA is available
      if (certificate.type === 'ca-signed' && this.caCertificate) {
        try {
          const verified = cert.verify(this.caCertificate);
          if (!verified) {
            errors.push('Certificate signature verification failed');
          }
        } catch (error) {
          errors.push('Certificate signature verification failed');
        }
      }

      this.logger.debug('Certificate validated', {
        subject: certificate.subject,
        valid: errors.length === 0,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error) {
      this.logger.error('Certificate validation failed', error);
      return {
        valid: false,
        errors: ['Certificate parsing failed'],
        warnings: []
      };
    }
  }

  /**
   * Renew certificate
   */
  async renewCertificate(
    originalCertificate: Certificate,
    validityDays: number = 365
  ): Promise<Certificate> {
    try {
      const cert = forge.pki.certificateFromPem(originalCertificate.certificate);
      const commonName = cert.subject.getField('CN')?.value || 'Unknown';
      const organizationName = cert.subject.getField('O')?.value || 'EKD Technologies';

      // Generate new certificate based on type
      let newCertificate: Certificate;
        switch (originalCertificate.type) {
        case 'self-signed':
          newCertificate = await this.generateSelfSignedCertificate(
            commonName,
            organizationName,
            validityDays
          );
          break;
        case 'ca-signed':
        case 'server':
          newCertificate = await this.generateServerCertificate(
            commonName,
            organizationName,
            [],
            validityDays
          );
          break;
        case 'client':
          // For client certificates, we need email address - try to extract from subject
          const emailField = cert.subject.getField('emailAddress');
          const emailAddress = emailField?.value || 'renewed@example.com';
          newCertificate = await this.generateClientCertificate(
            commonName,
            emailAddress,
            organizationName,
            validityDays
          );
          break;
        default:
          throw new CertificateError(`Cannot renew certificate of type: ${originalCertificate.type}`, 'UNSUPPORTED_TYPE');
      }

      this.logger.info('Certificate renewed', {
        originalSubject: originalCertificate.subject,
        newFingerprint: newCertificate.fingerprint
      });

      return newCertificate;
    } catch (error) {
      this.logger.error('Certificate renewal failed', error);
      throw new CertificateError('Certificate renewal failed', { error });
    }
  }

  /**
   * Export certificate to different formats
   */
  exportCertificate(certificate: Certificate, format: CertificateFormat): string {
    try {
      const cert = forge.pki.certificateFromPem(certificate.certificate);

      switch (format) {
        case 'pem':
          return certificate.certificate;
        case 'der':
          return forge.util.encode64(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());
        case 'p12':
          if (!certificate.privateKey) {
            throw new CertificateError('Private key required for P12 export');
          }
          const privateKey = forge.pki.privateKeyFromPem(certificate.privateKey);
          const p12Asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, [cert], 'password');
          return forge.util.encode64(forge.asn1.toDer(p12Asn1).getBytes());
        default:
          throw new CertificateError(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      this.logger.error('Certificate export failed', error);
      throw new CertificateError('Certificate export failed', { error });
    }
  }

  /**
   * Calculate certificate fingerprint
   */
  private calculateFingerprint(cert: forge.pki.Certificate): string {
    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const hash = forge.md.sha256.create();
    hash.update(der);
    return hash.digest().toHex().toUpperCase().match(/.{2}/g)?.join(':') || '';
  }

  /**
   * Generate serial number
   */
  private generateSerialNumber(): string {
    return Math.floor(Math.random() * 1000000000).toString();
  }
  /**
   * Get certificate statistics
   */
  getCertificateStatistics(): {
    total: number;
    valid: number;
    expiringSoon: number;
    expired: number;
    byType: Record<CertificateType, number>;
  } {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    
    let valid = 0;
    let expiringSoon = 0;
    let expired = 0;
    const byType: Record<CertificateType, number> = {
      'self-signed': 0,
      'ca-signed': 0,
      'intermediate': 0,
      'ca': 0,
      'client': 0,
      'server': 0
    };

    for (const cert of this.certificates.values()) {
      // Count by type
      byType[cert.type]++;

      // Check expiration
      if (cert.notAfter < now) {
        expired++;
      } else if (cert.notAfter < thirtyDaysFromNow) {
        expiringSoon++;
      } else {
        valid++;
      }
    }

    return {
      total: this.certificates.size,
      valid,
      expiringSoon,
      expired,
      byType
    };
  }

  /**
   * Cleanup expired certificates
   */
  cleanupExpiredCertificates(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [certId, cert] of this.certificates.entries()) {
      if (cert.notAfter < now) {
        this.certificates.delete(certId);
        cleanedCount++;
      }
    }

    this.logger.info('Expired certificates cleaned up', { cleanedCount });
    return cleanedCount;
  }
}
