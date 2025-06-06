import './jest-setup';
import { CertificateManager } from '../certificate-manager';
import { CertificateError } from '../types';

// Get the mocked forge module
const mockForge = require('node-forge');

describe('CertificateManager', () => {
  let certificateManager: CertificateManager;
  beforeEach(() => {
    certificateManager = new CertificateManager();
    // Reset all mocks completely
    jest.clearAllMocks();
    
    // Ensure the generateKeyPair mock is properly set up
    const createMockKeyPair = () => ({
      publicKey: {
        n: 'mock-modulus',
        e: 'mock-exponent'
      },
      privateKey: {
        n: 'mock-modulus',
        e: 'mock-exponent',
        d: 'mock-private-exponent'
      }
    });
      const createMockCertificate = () => ({
      publicKey: createMockKeyPair().publicKey,
      serialNumber: Math.floor(Math.random() * 1000000000).toString(), // Different serial each time
      validity: {
        notBefore: new Date('2025-01-01'),
        notAfter: new Date('2026-01-01')
      },
      subject: {
        attributes: [],
        getField: jest.fn().mockReturnValue({ value: 'test.example.com' })
      },
      issuer: {
        attributes: [],
        getField: jest.fn().mockReturnValue({ value: 'test.example.com' })
      },
      setSubject: jest.fn(),
      setIssuer: jest.fn(),
      setExtensions: jest.fn(),
      sign: jest.fn()
    });
    
    mockForge.pki.rsa.generateKeyPair.mockImplementation(() => createMockKeyPair());
    mockForge.pki.createCertificate.mockImplementation(() => createMockCertificate());
  });

  describe('Constructor', () => {
    test('should create instance successfully', () => {
      expect(certificateManager).toBeInstanceOf(CertificateManager);
    });
  });
  describe('CA Initialization', () => {
    test('should initialize CA with default parameters', async () => {
      const caCert = await certificateManager.initializeCA();
      
      expect(caCert).toBeDefined();
      expect(caCert.type).toBe('ca');
      expect(mockForge.pki.rsa.generateKeyPair).toHaveBeenCalled();
    });

    test('should initialize CA with custom parameters', async () => {
      const commonName = 'Custom CA';
      const organizationName = 'Custom Org';
      const validityDays = 365;
      
      const caCert = await certificateManager.initializeCA(commonName, organizationName, validityDays);
      
      expect(caCert).toBeDefined();
      expect(caCert.type).toBe('ca');
    });    test('should handle CA initialization errors', async () => {
      // Create a new certificate manager for this error test
      const errorCertificateManager = new CertificateManager();
      
      // Override the mock just for this test
      mockForge.pki.rsa.generateKeyPair.mockImplementationOnce(() => {
        throw new Error('Key generation failed');
      });

      await expect(errorCertificateManager.initializeCA()).rejects.toThrow(CertificateError);
    });
  });

  describe('Server Certificate Generation', () => {
    beforeEach(async () => {
      // Initialize CA first
      await certificateManager.initializeCA();
    });

    test('should generate server certificate', async () => {
      const commonName = 'test.example.com';
      
      const serverCert = await certificateManager.generateServerCertificate(commonName);
      
      expect(serverCert).toBeDefined();
      expect(serverCert.type).toBe('server');
    });

    test('should generate server certificate with SAN', async () => {
      const commonName = 'test.example.com';
      const organizationName = 'Test Org';
      const subjectAltNames = ['alt1.example.com', 'alt2.example.com'];
      
      const serverCert = await certificateManager.generateServerCertificate(
        commonName,
        organizationName,
        subjectAltNames
      );
      
      expect(serverCert).toBeDefined();
      expect(serverCert.type).toBe('server');
    });

    test('should throw error when CA not initialized', async () => {
      const newManager = new CertificateManager();
      
      await expect(
        newManager.generateServerCertificate('test.example.com')
      ).rejects.toThrow(CertificateError);
    });
  });

  describe('Client Certificate Generation', () => {
    beforeEach(async () => {
      // Initialize CA first
      await certificateManager.initializeCA();
    });

    test('should generate client certificate', async () => {
      const commonName = 'user123';
      const emailAddress = 'user123@example.com';
      
      const clientCert = await certificateManager.generateClientCertificate(commonName, emailAddress);
      
      expect(clientCert).toBeDefined();
      expect(clientCert.type).toBe('client');
    });    test('should handle client certificate generation errors', async () => {
      mockForge.pki.createCertificate.mockImplementationOnce(() => {
        throw new Error('Certificate creation failed');
      });

      await expect(
        certificateManager.generateClientCertificate('user123', 'user123@example.com')
      ).rejects.toThrow(CertificateError);
    });
  });

  describe('Self-Signed Certificate Generation', () => {
    test('should generate self-signed certificate', async () => {
      const commonName = 'selfsigned.example.com';
      
      const selfSignedCert = await certificateManager.generateSelfSignedCertificate(commonName);
      
      expect(selfSignedCert).toBeDefined();
      expect(selfSignedCert.type).toBe('self-signed');
    });
  });

  describe('Certificate Validation', () => {
    beforeEach(async () => {
      // Initialize CA first
      await certificateManager.initializeCA();
    });

    test('should validate certificate', async () => {
      const cert = await certificateManager.generateServerCertificate('test.example.com');
      
      const validationResult = certificateManager.validateCertificate(cert);
      
      expect(validationResult).toBeDefined();
      expect(validationResult.valid).toBe(true);
    });

    test('should detect invalid certificate', async () => {
      const invalidCert = {
        fingerprint: 'invalid',
        certificate: 'invalid-cert',
        publicKey: 'invalid-key',
        subject: 'invalid',
        issuer: 'invalid',
        serialNumber: 'invalid',
        notBefore: new Date('2020-01-01'),
        notAfter: new Date('2020-01-02'), // Expired
        format: 'pem' as const,
        type: 'server' as const
      };

      const validationResult = certificateManager.validateCertificate(invalidCert);
      
      expect(validationResult.valid).toBe(false);
    });
  });

  describe('Certificate Renewal', () => {
    beforeEach(async () => {
      // Initialize CA first
      await certificateManager.initializeCA();
    });

    test('should renew certificate', async () => {
      const originalCert = await certificateManager.generateServerCertificate('test.example.com');
      
      const renewedCert = await certificateManager.renewCertificate(originalCert);
      
      expect(renewedCert).toBeDefined();
      expect(renewedCert.fingerprint).not.toBe(originalCert.fingerprint);
    });

    test('should handle certificate renewal errors', async () => {
      const invalidCert = {
        fingerprint: 'invalid',
        certificate: 'invalid-cert',
        publicKey: 'invalid-key',
        subject: 'invalid',
        issuer: 'invalid',
        serialNumber: 'invalid',
        notBefore: new Date('2020-01-01'),
        notAfter: new Date('2020-01-02'),
        format: 'pem' as const,
        type: 'server' as const
      };

      await expect(
        certificateManager.renewCertificate(invalidCert)
      ).rejects.toThrow(CertificateError);
    });
  });

  describe('Certificate Export', () => {
    beforeEach(async () => {
      // Initialize CA first
      await certificateManager.initializeCA();
    });

    test('should export certificate in PEM format', async () => {
      const cert = await certificateManager.generateServerCertificate('test.example.com');
      
      const pemCert = certificateManager.exportCertificate(cert, 'pem');
      
      expect(typeof pemCert).toBe('string');
      expect(pemCert).toContain('BEGIN CERTIFICATE');
    });

    test('should export certificate in DER format', async () => {
      const cert = await certificateManager.generateServerCertificate('test.example.com');
      
      const derCert = certificateManager.exportCertificate(cert, 'der');
      
      expect(typeof derCert).toBe('string');
    });

    test('should export certificate in P12 format', async () => {
      const cert = await certificateManager.generateServerCertificate('test.example.com');
      
      const p12Cert = certificateManager.exportCertificate(cert, 'p12');
      
      expect(typeof p12Cert).toBe('string');
    });
  });

  describe('Certificate Statistics', () => {
    test('should get certificate statistics', () => {
      const stats = certificateManager.getCertificateStatistics();
      
      expect(stats).toBeDefined();
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.valid).toBe('number');
      expect(typeof stats.expired).toBe('number');
      expect(typeof stats.expiringSoon).toBe('number');
    });
  });

  describe('Cleanup Operations', () => {
    test('should cleanup expired certificates', () => {
      const cleanedCount = certificateManager.cleanupExpiredCertificates();
      
      expect(typeof cleanedCount).toBe('number');
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle forge errors gracefully', async () => {
      mockForge.pki.createCertificate.mockImplementation(() => {
        throw new Error('Forge error');
      });

      await expect(
        certificateManager.generateSelfSignedCertificate('test.example.com')
      ).rejects.toThrow(CertificateError);
    });
  });
});
