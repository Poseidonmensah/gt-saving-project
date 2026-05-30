import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // Back4App provides the PORT env; we default to 3000
  const port = process.env.PORT || 3000;

  app.use(helmet({ crossOriginEmbedderPolicy: false }));
  app.use(compression());
  
  // Open CORS for the initial handshake with Vercel
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

  // CRITICAL: listen on 0.0.0.0 for hosting environment
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Backend is live on port ${port}`, 'Bootstrap');
}
bootstrap();