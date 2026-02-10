import "dotenv/config";

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { StandardResponseInterceptor } from "@/core/modules/standard-response";
import helmet from "helmet";
import { json, urlencoded } from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const isProduction = process.env.NODE_ENV === "production";

  // Security headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false, // Disable CSP in dev for Swagger
      crossOriginEmbedderPolicy: false, // Allow embedding for Swagger UI
    }),
  );

  // Request size limits to prevent DoS attacks
  app.use(json({ limit: "10mb" }));
  app.use(urlencoded({ extended: true, limit: "10mb" }));

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

  // Only enable Swagger in non-production environments
  if (!isProduction) {
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
  }

  // Parse CORS origins from environment variable (comma-separated)
  // In production, always require explicit origins
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : isProduction
      ? false // Disable CORS in production if no origins configured
      : true; // Allow all origins in development

  app.enableCors({
    origin: corsOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-campus-id"],
    credentials: !isProduction, // Only allow credentials in non-production
  });

  await app.listen(process.env.APP_PORT ?? process.env.PORT ?? 3000);
}
bootstrap();
