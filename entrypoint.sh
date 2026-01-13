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

# Run database seeding if SEED_DATABASE is set to true or if this is the first run
if [ "$SEED_DATABASE" = "true" ]; then
  echo "🌱 Seeding database..."
  npx prisma db seed
  echo "✅ Database seeding completed!"
elif [ "$SEED_ON_EMPTY" = "true" ]; then
  # Check if database has any data by checking if campus table has rows
  echo "🔍 Checking if database needs seeding..."

  # Use node to check if campus table is empty (more reliable than shell)
  NEEDS_SEED=$(node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.campus.count()
      .then(count => {
        console.log(count === 0 ? 'yes' : 'no');
        process.exit(0);
      })
      .catch(() => {
        console.log('yes');
        process.exit(0);
      })
      .finally(() => prisma.\$disconnect());
  " 2>/dev/null || echo "yes")

  if [ "$NEEDS_SEED" = "yes" ]; then
    echo "🌱 Database is empty, running initial seed..."
    npx prisma db seed
    echo "✅ Initial database seeding completed!"
  else
    echo "📊 Database already has data, skipping seed."
  fi
fi

echo "🚀 Starting application..."
exec "$@"
