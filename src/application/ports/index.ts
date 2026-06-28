/**
 * Application Ports (Interfaces)
 *
 * This module exports all port interfaces used in the application layer.
 * Ports define contracts that infrastructure adapters must implement.
 *
 * Following Clean Architecture principles:
 * - Application layer defines WHAT needs to be done (interfaces)
 * - Infrastructure layer defines HOW to do it (implementations)
 */

export * from "./authentication.port";
export * from "./identity.port";
export * from "./student-code-generator.port";
export * from "./unit-of-work.port";
