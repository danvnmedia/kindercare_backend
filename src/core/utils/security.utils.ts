import { randomBytes } from "crypto";

/**
 * Security utilities for the application.
 * Provides secure password generation and validation.
 */

const PASSWORD_LENGTH = 16;
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijklmnopqrstuvwxyz";
const NUMBERS = "0123456789";
const SYMBOLS = "!@#$%^&*()_+-=[]{}|;:,.<>?";

/**
 * Generates a cryptographically secure random password.
 * Ensures the password contains at least one character from each category.
 *
 * @param length - Password length (default: 16, minimum: 12)
 * @returns A secure random password
 */
export function generateSecurePassword(
  length: number = PASSWORD_LENGTH,
): string {
  const minLength = 12;
  const actualLength = Math.max(length, minLength);

  const allChars = UPPERCASE + LOWERCASE + NUMBERS + SYMBOLS;

  // Ensure at least one character from each category
  const password: string[] = [
    getRandomChar(UPPERCASE),
    getRandomChar(LOWERCASE),
    getRandomChar(NUMBERS),
    getRandomChar(SYMBOLS),
  ];

  // Fill the rest with random characters from all categories
  for (let i = password.length; i < actualLength; i++) {
    password.push(getRandomChar(allChars));
  }

  // Shuffle the password array using Fisher-Yates algorithm
  for (let i = password.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    [password[i], password[j]] = [password[j], password[i]];
  }

  return password.join("");
}

/**
 * Gets a random character from a string using cryptographically secure randomness.
 */
function getRandomChar(chars: string): string {
  return chars[getSecureRandomInt(chars.length)];
}

/**
 * Generates a cryptographically secure random integer in range [0, max).
 */
function getSecureRandomInt(max: number): number {
  const bytes = randomBytes(4);
  const value = bytes.readUInt32BE(0);
  return value % max;
}

/**
 * File validation constants and utilities
 */
export const FILE_VALIDATION = {
  // Maximum file size in bytes (50MB)
  MAX_FILE_SIZE: 50 * 1024 * 1024,

  // Allowed MIME types by category
  ALLOWED_MIME_TYPES: {
    images: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    documents: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "text/csv",
    ],
    videos: ["video/mp4", "video/webm", "video/quicktime"],
    audio: ["audio/mpeg", "audio/wav", "audio/ogg"],
  },

  // All allowed MIME types (flattened)
  getAllAllowedMimeTypes(): string[] {
    return [
      ...this.ALLOWED_MIME_TYPES.images,
      ...this.ALLOWED_MIME_TYPES.documents,
      ...this.ALLOWED_MIME_TYPES.videos,
      ...this.ALLOWED_MIME_TYPES.audio,
    ];
  },

  // Dangerous file extensions that should always be blocked
  BLOCKED_EXTENSIONS: [
    ".exe",
    ".bat",
    ".cmd",
    ".sh",
    ".ps1",
    ".vbs",
    ".js",
    ".jar",
    ".msi",
    ".dll",
    ".scr",
    ".com",
    ".pif",
    ".php",
    ".asp",
    ".aspx",
    ".jsp",
  ],
};

/**
 * Validates file upload parameters.
 *
 * @param filename - The name of the file
 * @param mimeType - The MIME type of the file
 * @param size - The size of the file in bytes
 * @returns An object with isValid and error message
 */
export function validateFileUpload(
  filename: string,
  mimeType: string,
  size: number,
): { isValid: boolean; error?: string } {
  // Check file size
  if (size > FILE_VALIDATION.MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds maximum allowed size of ${FILE_VALIDATION.MAX_FILE_SIZE / (1024 * 1024)}MB`,
    };
  }

  if (size <= 0) {
    return {
      isValid: false,
      error: "File size must be greater than 0",
    };
  }

  // Check MIME type
  const allowedMimeTypes = FILE_VALIDATION.getAllAllowedMimeTypes();
  if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
    return {
      isValid: false,
      error: `File type '${mimeType}' is not allowed. Allowed types: images, documents, videos, audio`,
    };
  }

  if (!filename.trim()) {
    return {
      isValid: false,
      error: "Filename is required",
    };
  }

  // eslint-disable-next-line no-control-regex -- control bytes are intentionally rejected
  if (/[\\/\0\x00-\x1F\x7F]/.test(filename)) {
    return {
      isValid: false,
      error: "Filename contains invalid characters",
    };
  }

  // Check for blocked extensions
  const lastDot = filename.lastIndexOf(".");
  const extension =
    lastDot === -1 ? "" : filename.toLowerCase().substring(lastDot);
  if (extension && FILE_VALIDATION.BLOCKED_EXTENSIONS.includes(extension)) {
    return {
      isValid: false,
      error: `File extension '${extension}' is not allowed for security reasons`,
    };
  }

  // Check for double extensions (e.g., file.jpg.exe)
  const parts = filename.toLowerCase().split(".");
  if (parts.length > 2) {
    for (const part of parts.slice(1, -1)) {
      if (FILE_VALIDATION.BLOCKED_EXTENSIONS.includes(`.${part}`)) {
        return {
          isValid: false,
          error: "File contains suspicious double extension",
        };
      }
    }
  }

  return { isValid: true };
}

/**
 * Sanitizes a file path to prevent path traversal attacks.
 *
 * @param key - The file key/path to sanitize
 * @returns The sanitized key or throws an error if invalid
 */
export function sanitizeUploadFilename(filename: string): string {
  const normalized = filename.normalize("NFKC").trim();
  const extensionIndex = normalized.lastIndexOf(".");
  const rawBase =
    extensionIndex > 0 ? normalized.slice(0, extensionIndex) : normalized;
  const rawExtension =
    extensionIndex > 0 ? normalized.slice(extensionIndex) : "";

  const safeBase = rawBase
    // eslint-disable-next-line no-control-regex -- control bytes are intentionally replaced
    .replace(/[\\/\0\x00-\x1F\x7F]/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 120);

  const safeExtension = rawExtension
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "")
    .slice(0, 20);

  return `${safeBase || "file"}${safeExtension}`;
}

export function sanitizeFilePath(key: string): string {
  // Remove null bytes
  const sanitized = key.replace(/\0/g, "");

  // Check for path traversal attempts
  if (
    sanitized.includes("..") ||
    sanitized.startsWith("/") ||
    sanitized.startsWith("\\") ||
    /^[a-zA-Z]:/.test(sanitized) // Windows absolute path
  ) {
    throw new Error("Invalid file path: path traversal detected");
  }

  // Remove any leading/trailing whitespace
  return sanitized.trim();
}
