#!/bin/sh
set -e

echo "Starting entrypoint script..."

# Wait for database to be ready
echo "Waiting for database connection..."
until npx prisma db push --accept-data-loss 2>/dev/null; do
  echo "Database is unavailable - sleeping..."
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
