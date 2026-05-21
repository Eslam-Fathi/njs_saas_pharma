# Stage 1: Build
FROM node:22-alpine AS builder

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
FROM node:22-alpine AS production

WORKDIR /usr/src/app

# OpenSSL is required by Prisma
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

# Instead of installing production dependencies again, we copy the node_modules
# from the builder stage. This ensures the Prisma Client generated in Stage 1
# is perfectly preserved and available without needing to run generate again!
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Copy the compiled application from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

EXPOSE 3000

# Start the application
CMD [ "npm", "run", "start:prod" ]
