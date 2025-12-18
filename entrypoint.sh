#!/bin/sh
set -e

echo "Starting entrypoint script..."

# Wait for database to be ready
echo "Waiting for database connection..."
echo "DATABASE_URL: $DATABASE_URL"

MAX_RETRIES=30
RETRY_COUNT=0

until npx prisma migrate status > /dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "Failed to connect to database after $MAX_RETRIES attempts"
    echo "Checking connection error:"
    npx prisma migrate status
    exit 1
  fi
  echo "Database is unavailable - attempt $RETRY_COUNT/$MAX_RETRIES - sleeping..."
  sleep 2
done

echo "Database is ready!"

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

echo "Starting application..."
exec "$@"
