FROM node:22-alpine

WORKDIR /app

# Install dependencies for native modules and dos2unix for line ending conversion
RUN apk add --no-cache python3 make g++ dos2unix netcat-openbsd

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate


COPY entrypoint.sh /usr/local/bin/
RUN dos2unix /usr/local/bin/entrypoint.sh && chmod +x /usr/local/bin/entrypoint.sh

# Default port, can be overridden via PORT env var
EXPOSE 8000
EXPOSE 9229

# Use entrypoint script
ENTRYPOINT ["entrypoint.sh"]
