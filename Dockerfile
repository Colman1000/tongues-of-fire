# Use the official Bun image as the base
# Updated to 'latest' to ensure Bun.S3Client is available
FROM oven/bun:latest

# Set the working directory inside the container
WORKDIR /usr/src/app

# Install build essentials for SQLite and other potential native dependencies
# Using apt-get for Debian-based image
RUN apt-get update && apt-get install -y build-essential python3 make g++

# Copy package management files
COPY package.json bun.lock ./

# Install dependencies using the frozen lockfile for reproducibility
RUN bun install --frozen-lockfile

# Copy the rest of the application source code
COPY . .

# Expose the port the application will run on
EXPOSE 3000