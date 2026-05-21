# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies needed for Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies)
RUN npm ci

COPY . .

# Generate Prisma Client and build the application
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /usr/src/app

# OpenSSL is required by Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies to keep the image small
RUN npm ci --omit=dev

# Generate Prisma Client for the production environment
RUN npx prisma generate

# Copy the compiled application from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000

# Start the application
CMD [ "npm", "run", "start:prod" ]
