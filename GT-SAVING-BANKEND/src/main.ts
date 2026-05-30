import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  const configService = app.get(ConfigService);
  
  // Use the PORT provided by Back4App, default to 3000
  const port = process.env.PORT || 3000;

  // Security and Performance
  app.use(helmet({ 
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false 
  }));
  app.use(compression());

  // Allow Vercel to talk to this server
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    transformOptions: { enableImplicitConversion: true } 
  }));

  // CRITICAL FIX: Bind to '0.0.0.0' for Cloud Hosting
  await app.listen(port, '0.0.0.0');
  
  Logger.log(`🚀 Backend is live on port ${port}`, 'Bootstrap');
}
bootstrap();