# Stage 1: Build
# Use the official Node.js LTS image
FROM node:20-alpine3.18 as builder

# Set the working directory inside the container
WORKDIR /app

# Copy necessary files for installing dependencies
COPY package.json yarn.lock ./


COPY . .


RUN yarn install

# Cleanup unnecessary files to prepare for the next stage
RUN rm -rf src node_modules/dev

# Stage 2: Runtime
# Use the official Node.js LTS image for the runtime stage
FROM node:20-alpine3.18


# Set the working directory inside the container
WORKDIR /app

# Copy necessary files from the builder stage
COPY --from=builder /app /app


# Make sure the production dependencies are ready (if any were removed during build)
RUN yarn install --production --frozen-lockfile && \
    yarn cache clean



# Command to run your app
CMD ["yarn", "start"]
