import "dotenv/config";

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { StandardResponseInterceptor } from "@/core/modules/standard-response";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );


  const standardResponseInterceptor = app.get(StandardResponseInterceptor);
  app.useGlobalInterceptors(standardResponseInterceptor);

  app.setGlobalPrefix('api', {
      exclude: [{ path: 'docs', method: RequestMethod.GET }],
  });

  const config = new DocumentBuilder()
    .setTitle("NestJS Boilerplate API")
    .setDescription(
      "API documentation for NestJS Clean Architecture Boilerplate",
    )
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Enter JWT token",
        in: "header",
      },
      "JWT",
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  app.enableCors({
    origin: process.env.CORS_ORIGIN || true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
