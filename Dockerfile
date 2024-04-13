# Use the official Node.js LTS image
FROM node:20-alpine3.18


# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to install dependencies
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy the rest of your application code
COPY . .


RUN node -v
# Command to run your app
CMD ["node", "./src/main.js"]
