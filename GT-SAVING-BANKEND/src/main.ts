import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  try {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);
    
    // Use Port 3000 for Back4App
    const port = process.env.PORT || 3000;

    app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));
    app.use(compression());
    app.enableCors({ origin: '*', credentials: true });
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // CRITICAL: Bind to 0.0.0.0
    await app.listen(port, '0.0.0.0');
    logger.log(`✅ Backend is successfully listening on port ${port}`);
  } catch (error) {
    logger.error(`❌ STARTUP FAILED: ${error.message}`);
    process.exit(1);
  }
}
bootstrap();