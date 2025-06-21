/**
 * Test setup for crypto package
 */

// Mock node-forge for consistent testing
jest.mock('node-forge', () => {
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
    serialNumber: '123456789',
    validity: {
      notBefore: new Date('2024-01-01'),
      notAfter: new Date('2025-01-01')
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

  return {
    pki: {      rsa: {
        generateKeyPair: jest.fn().mockImplementation(() => createMockKeyPair())
      },
      generateKeyPair: jest.fn().mockImplementation(() => createMockKeyPair()),
      publicKeyToPem: jest.fn().mockReturnValue('-----BEGIN PUBLIC KEY-----\nmock-public-key\n-----END PUBLIC KEY-----'),
      privateKeyToPem: jest.fn().mockReturnValue('-----BEGIN PRIVATE KEY-----\nmock-private-key\n-----END PRIVATE KEY-----'),      publicKeyFromPem: jest.fn().mockImplementation(() => createMockKeyPair().publicKey),
      privateKeyFromPem: jest.fn().mockImplementation(() => createMockKeyPair().privateKey),      certificateFromPem: jest.fn().mockImplementation((pemString) => {
        // Handle invalid certificates
        if (pemString === 'invalid-cert' || pemString.includes('invalid')) {
          throw new Error('Invalid certificate format');
        }
        
        return {
          subject: { 
            attributes: [{ name: 'commonName', value: 'test.example.com' }],
            getField: jest.fn().mockImplementation((field: string) => {
              const fieldMap: Record<string, { value: string }> = {
                'CN': { value: 'test.example.com' },
                'O': { value: 'EKD Technologies' },
                'emailAddress': { value: 'test@example.com' }
              };
              return fieldMap[field] || { value: 'test.example.com' };
            })
          },
          issuer: { 
            attributes: [{ name: 'commonName', value: 'test.example.com' }],
            getField: jest.fn().mockImplementation((field: string) => {
              const fieldMap: Record<string, { value: string }> = {
                'CN': { value: 'test.example.com' },
                'O': { value: 'EKD Technologies' }
              };
              return fieldMap[field] || { value: 'test.example.com' };
            })
          },
          serialNumber: '123456789',
          validity: {
            notBefore: new Date('2025-01-01'), // Valid from this year
            notAfter: new Date('2026-01-01')   // Valid until next year
          },
          verify: jest.fn().mockReturnValue(true)
        };
      }),
      certificateToPem: jest.fn().mockReturnValue('-----BEGIN CERTIFICATE-----\nmock-certificate\n-----END CERTIFICATE-----'),      createCertificate: jest.fn().mockImplementation(() => createMockCertificate()),
      certificateToAsn1: jest.fn().mockReturnValue({}),
      verifyCertificateChain: jest.fn().mockReturnValue(true)
    },
    asn1: {
      toDer: jest.fn().mockReturnValue({
        getBytes: jest.fn().mockReturnValue('mock-der-bytes')
      })
    },
    util: {
      encode64: jest.fn().mockReturnValue('mock-base64-encoded')
    },    md: {
      sha256: {
        create: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue({
            toHex: jest.fn().mockImplementation(() => {
              // Generate a different hash each time for unique fingerprints
              const randomHex = Math.random().toString(16).substring(2, 18);
              return `${randomHex}${'0'.repeat(64 - randomHex.length)}`;
            })
          })
        })
      },
      sha1: {
        create: jest.fn().mockReturnValue({
          update: jest.fn().mockReturnThis(),
          digest: jest.fn().mockReturnValue({
            toHex: jest.fn().mockReturnValue('mock-hash')
          })
        })
      }
    },
    pkcs12: {
      toPkcs12Asn1: jest.fn().mockReturnValue({})
    }
  };
});

// Global test timeout
jest.setTimeout(10000);

// Cleanup after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test utilities
(global as any).createMockLogger = () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  createLogger: jest.fn().mockReturnThis()
});

// Mock Logger from shared package
jest.mock('@ekd-desk/shared', () => ({
  Logger: {
    createLogger: jest.fn().mockReturnValue({
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    })
  }
}));
