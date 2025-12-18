#!/bin/sh
set -e

# Extract database host from DATABASE_URL
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')

echo "⏳ Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."

# Simple TCP connection check
max_retries=30
retry_count=0

while [ $retry_count -lt $max_retries ]; do
  if nc -z $DB_HOST $DB_PORT 2>/dev/null; then
    echo "✅ PostgreSQL is ready!"
    break
  fi
  echo "⏳ PostgreSQL is unavailable - sleeping (attempt $((retry_count+1))/$max_retries)"
  sleep 2
  retry_count=$((retry_count+1))
done

if [ $retry_count -eq $max_retries ]; then
  echo "❌ Failed to connect to PostgreSQL after $max_retries attempts"
  exit 1
fi

echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "✅ Migrations completed!"

echo "🚀 Starting application..."
exec "$@"
