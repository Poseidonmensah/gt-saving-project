import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  // Create the NestJS application
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  
  // Back4App assigns a random PORT; we must use process.env.PORT
  const port = process.env.PORT || 3000;

  // 1. Security: Enable Helmet (Standard for production)
  app.use(helmet({ 
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false 
  }));

  // 2. Performance: Enable Gzip compression
  app.use(compression());

  // 3. CORS: Allow your Vercel website to talk to this backend
  app.enableCors({
    origin: '*', // Set this to your Vercel URL later for better security
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 4. Global Path: Standardize API routes to /api/v1/...
  app.setGlobalPrefix('api/v1');

  // 5. Validation: Auto-check incoming data for errors
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    transformOptions: { enableImplicitConversion: true } 
  }));

  // 6. CRITICAL FOR HOSTING: 
  // We MUST listen on '0.0.0.0' so the cloud server can see the app.
  // We use the 'port' variable defined above.
  await app.listen(port, '0.0.0.0');

  Logger.log(`🚀 Backend is live and listening on port ${port}`, 'Bootstrap');
}

bootstrap();