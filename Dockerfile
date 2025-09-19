# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    postgresql-client \
    redis \
    curl

# Copy package files
COPY backend/package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy backend source code
COPY backend/ ./

# Create logs directory
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S taskscheduler -u 1001

# Change ownership of app directory
RUN chown -R taskscheduler:nodejs /app

# Switch to non-root user
USER taskscheduler

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]