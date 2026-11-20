import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const production = config.get<string>('nodeEnv') === 'production';

  // Derrière un reverse proxy TLS : l'adresse IP réelle et le protocole proviennent de X-Forwarded-*
  app.set('trust proxy', 1);

  // Redirection HTTP vers HTTPS (production)
  if (config.get<boolean>('forceHttps')) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
      if (req.method === 'GET' || req.method === 'HEAD') return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
      return res.status(426).json({ statusCode: 426, message: 'HTTPS requis.' });
    });
  }

  // En-têtes de sécurité : HSTS (2 ans, sous-domaines, preload) et CSP restrictive pour une API JSON
  app.use(
    helmet({
      hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
      contentSecurityPolicy: production ? { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } } : false,
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );

  app.enableCors({
    origin: config.get<string[]>('corsOrigins'),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.enableShutdownHooks();

  if (!production) {
    const doc = new DocumentBuilder()
      .setTitle('Registre de diplômes - API')
      .setDescription('API métier NestJS / Fabric Gateway (Hyperledger Fabric)')
      .setVersion('2.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }

  const port = config.getOrThrow<number>('port');
  await app.listen(port);
  Logger.log(`API démarrée sur le port ${port}`, 'Bootstrap');
}

bootstrap();
