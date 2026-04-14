FROM node:22-slim
WORKDIR /app

# Copy package files and install
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy built dist
COPY dist/ ./dist/

# The MCP server runs on stdio by default
ENTRYPOINT ["node", "dist/index.js"]
