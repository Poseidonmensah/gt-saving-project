import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // Use the PORT provided by the environment (Back4App), defaulting to 3000
  const port = process.env.PORT || configService.get<number>('PORT', 3000);

  // Security Middleware
  app.use(helmet({ 
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false // Disable CSP for simpler development/hosting handshake
  }));
  
  app.use(compression());

  // CORS Configuration: Allows your Vercel frontend to communicate with this Backend
  app.enableCors({
    origin: true, // This allows all origins in development; change to your Vercel URL later
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Idempotency-Key', 'X-Request-ID'],
  });

  // Sets the base path for all routes (e.g., https://your-app.back4app.io/api/v1/...)
  app.setGlobalPrefix('api/v1');

  // Automatic Data Validation
  app.useGlobalPipes(new ValidationPipe({ 
    whitelist: true, 
    transform: true,
    transformOptions: { enableImplicitConversion: true } 
  }));

  // Fail-safe check for JWT Secret
  if (!configService.get('JWT_SECRET')) {
    Logger.error('JWT_SECRET is not set! Authentication will fail. Please add it to Back4App Environment Variables.', 'Bootstrap');
  }

  // CRITICAL: Bind to 0.0.0.0 so Back4App's health check can reach the app
  await app.listen(port, '0.0.0.0');
  
  Logger.log(`🚀 Backend is live and listening on port ${port}`, 'Bootstrap');
}
bootstrap();