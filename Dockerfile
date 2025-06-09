# Use the official Bun image as the base
FROM oven/bun:1.0

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package management files
COPY package.json bun.lockb ./

# Install dependencies using the frozen lockfile for reproducibility
RUN bun install --frozen-lockfile

# Copy the rest of the application source code
COPY . .

# Expose the port the application will run on
EXPOSE 3000

# The command to run when the container starts
# This starts the Hono server. The background job would typically run in a separate container.
CMD ["bun", "run", "src/index.ts"]
