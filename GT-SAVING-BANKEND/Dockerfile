# 1. Use Node.js version 20
FROM node:20-alpine

# 2. Set the working directory
WORKDIR /app

# 3. Copy package files
COPY package*.json ./

# 4. Install dependencies
RUN npm install --legacy-peer-deps

# 5. Copy the rest of your code
COPY . .

# 6. Build the project
RUN npm run build

# 7. Expose the port (NestJS usually uses 3000)
EXPOSE 3000

# 8. Start the app
CMD ["npm", "run", "start:prod"]