import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // Use Back4App's port or default to 3000
  const port = process.env.PORT || 3000;

  app.use(helmet({ crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.enableCors({ origin: '*', credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // CRITICAL: listen on 0.0.0.0
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Backend is live on port ${port}`, 'Bootstrap');
}
bootstrap();