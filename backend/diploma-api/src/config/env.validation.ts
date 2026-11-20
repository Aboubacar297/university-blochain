const REQUIRED = [
  'FABRIC_MSP_ID',
  'FABRIC_PEER_ENDPOINT',
  'FABRIC_PEER_HOST_ALIAS',
  'FABRIC_CERT_PATH',
  'FABRIC_KEY_PATH',
  'FABRIC_TLS_CERT_PATH',
  'MINIO_ENDPOINT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'KEYCLOAK_URL',
  'KEYCLOAK_REALM',
  'ENCRYPTION_KEY_HEX',
  'STUDENT_REF_PEPPER',
  'SHARE_TOKEN_SECRET',
];

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  // En mode simulé, les variables Fabric ne sont pas nécessaires.
  const mock = String(config.FABRIC_MOCK) === 'true';
  const required = mock ? REQUIRED.filter((k) => !k.startsWith('FABRIC_')) : REQUIRED;
  const missing = required.filter((k) => !config[k] || String(config[k]).trim() === '');
  if (missing.length > 0) {
    throw new Error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
  }
  if (config.NODE_ENV === 'production') {
    const prod = ['TURNSTILE_SECRET_KEY', 'KEYCLOAK_ADMIN_CLIENT_SECRET', 'CORS_ORIGINS'].filter(
      (k) => !config[k] || String(config[k]).trim() === '',
    );
    if (prod.length > 0) throw new Error(`Variables obligatoires en production : ${prod.join(', ')}`);
    if (String(config.FORCE_HTTPS) !== 'true') throw new Error('FORCE_HTTPS=true est obligatoire en production.');
  }
  if (!/^[0-9a-fA-F]{64}$/.test(String(config.ENCRYPTION_KEY_HEX))) {
    throw new Error('ENCRYPTION_KEY_HEX doit contenir 64 caractères hexadécimaux (32 octets).');
  }
  if (String(config.SHARE_TOKEN_SECRET).length < 32) {
    throw new Error('SHARE_TOKEN_SECRET doit contenir au moins 32 caractères.');
  }
  if (String(config.STUDENT_REF_PEPPER).length < 32) {
    throw new Error('STUDENT_REF_PEPPER doit contenir au moins 32 caractères.');
  }
  return config;
}
