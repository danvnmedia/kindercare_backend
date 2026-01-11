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

  app.setGlobalPrefix("api", {
    exclude: [{ path: "docs", method: RequestMethod.GET }],
  });

  const config = new DocumentBuilder()
    .setTitle("Kindercare Multi-Campus API")
    .setDescription(
      "API documentation for Kindercare multi-campus school management system. " +
        "Most endpoints require X-Campus-Id header to scope requests to a specific campus.",
    )
    .setVersion("1.0")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "Enter JWT token from Clerk authentication",
        in: "header",
      },
      "JWT",
    )
    .addApiKey(
      {
        type: "apiKey",
        name: "x-campus-id",
        in: "header",
        description:
          "Campus UUID to scope the request. Required for most campus-scoped endpoints.",
      },
      "X-Campus-Id",
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
    allowedHeaders: ["Content-Type", "Authorization", "x-campus-id"],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
