import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Set HTTP security headers
  app.use(helmet());

  // Set consistent response formats
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Enable validation globally for all DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strips non-whitelisted properties from input DTOs
      transform: true, // Automatically transforms payloads to match DTO types
      forbidNonWhitelisted: true,
    }),
  );

  // Set the API prefix to v1 matching API Contracts specification
  app.setGlobalPrefix('v1');

  // Enable CORS
  app.enableCors();

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/v1`);
}
void bootstrap();
