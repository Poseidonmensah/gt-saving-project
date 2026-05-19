# 1. Use Node.js
FROM node:20-alpine

# 2. Install tools needed for Alpine
RUN apk add --no-cache libc6-compat

# 3. Set the work directory inside the container
WORKDIR /app

# 4. COPY package files from your folder to the container
# This looks for the folder named GT-SAVING-BANKEND
COPY GT-SAVING-BANKEND/package*.json ./

# 5. Install dependencies
RUN npm install --legacy-peer-deps

# 6. COPY the rest of the code from that folder
COPY GT-SAVING-BANKEND/ .

# 7. Build the NestJS project
RUN npm run build

# 8. Expose the port
EXPOSE 3000

# 9. Start the app
CMD ["npm", "run", "start:prod"]
