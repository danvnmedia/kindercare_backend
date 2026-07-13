-- Create database if it doesn't exist
-- This runs automatically when PostgreSQL initializes
SELECT 'CREATE DATABASE kindercare'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kindercare')\gexec
