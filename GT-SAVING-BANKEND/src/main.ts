import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // Back4App provides the PORT environment variable
  const port = process.env.PORT || configService.get<number>('PORT', 3000);

  app.use(helmet({ crossOriginEmbedderPolicy: false }));
  app.use(compression());
  app.enableCors({ origin: '*', credentials: true });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Use '0.0.0.0' to allow external health checks to reach the app
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Backend is live on port ${port}`, 'Bootstrap');
}
bootstrap();