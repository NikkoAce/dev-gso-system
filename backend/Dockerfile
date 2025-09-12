# Use an official Node.js runtime as a parent image
FROM node:18-slim

# Set the working directory in the container
WORKDIR /opt/render/project/src

# --- Install MongoDB Database Tools ---
# See: https://www.mongodb.com/docs/database-tools/installation/installation-linux/
# 1. Add MongoDB public GPG key and dependencies
RUN apt-get update && \
    apt-get install -y wget gnupg && \
    wget -qO- https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add -

# 2. Create a list file for MongoDB
RUN echo "deb http://repo.mongodb.org/apt/debian bullseye/mongodb-org/7.0 main" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list

# 3. Update package list and install the tools, then clean up
RUN apt-get update && \
    apt-get install -y mongodb-database-tools && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# --- Standard Node.js App Setup ---
COPY package*.json ./
RUN npm install
COPY . .

# Define the command to run your app
CMD ["npm", "start"]