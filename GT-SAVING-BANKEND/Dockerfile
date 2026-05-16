# 1. Use Node.js version 20 Alpine for a small, fast image
FROM node:20-alpine

# 2. Install dependencies needed for some node modules on Alpine
RUN apk add --no-cache libc6-compat

# 3. Set the working directory
WORKDIR /app

# 4. Copy package files first (better for caching)
COPY package*.json ./

# 5. Install dependencies using the legacy-peer-deps flag to avoid NestJS 11 conflicts
RUN npm install --legacy-peer-deps

# 6. Copy the rest of your application code
COPY . .

# 7. Build the NestJS project
RUN npm run build

# 8. Expose the port (Back4App and NestJS standard)
EXPOSE 3000

# 9. Start the application in production mode
CMD ["npm", "run", "start:prod"]