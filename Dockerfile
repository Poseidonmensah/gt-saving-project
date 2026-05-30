# 1. Use Node.js version 20
FROM node:20-alpine

# 2. Install libc tools for NestJS compatibility
RUN apk add --no-cache libc6-compat

# 3. Set the work directory
WORKDIR /app

# 4. Copy package files from the subfolder
COPY GT-SAVING-BANKEND/package*.json ./

# 5. Install dependencies with the legacy flag
RUN npm install --legacy-peer-deps

# 6. Copy the entire code folder
COPY GT-SAVING-BANKEND/ .

# 7. Build the production code
RUN npm run build

# 8. Set the PORT and expose it
ENV PORT=3000
EXPOSE 3000

# 9. Start the application
CMD ["npm", "run", "start:prod"]