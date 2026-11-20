export interface FabricConfig {
  mspId: string;
  channel: string;
  chaincode: string;
  peerEndpoint: string;
  peerHostAlias: string;
  certPath: string;
  keyPath: string;
  tlsCertPath: string;
}

export interface MinioConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
}

export interface KeycloakConfig {
  url: string;
  realm: string;
  issuer: string;
  audience?: string;
  /** Compte de service (client confidentiel) utilisé par le backend pour gérer les comptes étudiants. */
  adminClientId?: string;
  adminClientSecret?: string;
}

export interface AccessConfig {
  /** Durée de validité d'un accès étudiant, en jours (cycle de 30 jours). */
  windowDays: number;
  dataDir: string;
  turnstileSecret?: string;
  issuerUrl: string;
}

export interface SecurityConfig {
  encryptionKeyHex: string;
  studentRefPepper: string;
  shareTokenSecret: string;
  maxPdfSizeMb: number;
}

export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  fabric: {
    mspId: process.env.FABRIC_MSP_ID!,
    channel: process.env.FABRIC_CHANNEL ?? 'diploma-channel',
    chaincode: process.env.FABRIC_CHAINCODE ?? 'diplomacontract',
    peerEndpoint: process.env.FABRIC_PEER_ENDPOINT!,
    peerHostAlias: process.env.FABRIC_PEER_HOST_ALIAS!,
    certPath: process.env.FABRIC_CERT_PATH!,
    keyPath: process.env.FABRIC_KEY_PATH!,
    tlsCertPath: process.env.FABRIC_TLS_CERT_PATH!,
  } as FabricConfig,
  minio: {
    endPoint: process.env.MINIO_ENDPOINT!,
    port: parseInt(process.env.MINIO_PORT ?? '9000', 10),
    useSSL: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY!,
    secretKey: process.env.MINIO_SECRET_KEY!,
    bucket: process.env.MINIO_BUCKET ?? 'diplomas',
  } as MinioConfig,
  keycloak: {
    url: (process.env.KEYCLOAK_URL ?? '').replace(/\/+$/, ''),
    realm: process.env.KEYCLOAK_REALM ?? '',
    adminClientId: process.env.KEYCLOAK_ADMIN_CLIENT_ID || undefined,
    adminClientSecret: process.env.KEYCLOAK_ADMIN_CLIENT_SECRET || undefined,
    issuer: `${(process.env.KEYCLOAK_URL ?? '').replace(/\/+$/, '')}/realms/${process.env.KEYCLOAK_REALM ?? ''}`,
    audience: process.env.KEYCLOAK_AUDIENCE || undefined,
  } as KeycloakConfig,
  access: {
    windowDays: parseInt(process.env.ACCESS_WINDOW_DAYS ?? '30', 10),
    dataDir: process.env.DATA_DIR ?? './data',
    turnstileSecret: process.env.TURNSTILE_SECRET_KEY || undefined,
    issuerUrl: process.env.ISSUER_URL ?? 'https://www.um5.ac.ma',
  } as AccessConfig,
  forceHttps: (process.env.FORCE_HTTPS ?? 'false') === 'true',
  security: {
    encryptionKeyHex: process.env.ENCRYPTION_KEY_HEX!,
    studentRefPepper: process.env.STUDENT_REF_PEPPER!,
    shareTokenSecret: process.env.SHARE_TOKEN_SECRET!,
    maxPdfSizeMb: parseInt(process.env.MAX_PDF_SIZE_MB ?? '10', 10),
  } as SecurityConfig,
});
