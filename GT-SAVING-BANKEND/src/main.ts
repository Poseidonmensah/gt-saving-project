import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  
  // Back4App assigned port or 3000
  const port = process.env.PORT || 3000;

  app.use(helmet({ crossOriginEmbedderPolicy: false }));
  app.use(compression());
  
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

  // CRITICAL: listen on 0.0.0.0 so Back4App health check succeeds
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Backend is listening on 0.0.0.0:${port}`, 'Bootstrap');
}
bootstrap();