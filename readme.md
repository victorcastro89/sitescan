## .env Required Fields
PG_HOST=db
PG_DATABASE=postgres
PG_USER=docker
PG_PASSWORD=docker


## Install Puppeteer for Wappalyzer

sudo apt-get update
sudo apt-get install -y wget --no-install-recommends \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
    libgdk-pixbuf2.0-0 libgtk-3-0 libnspr4 libnss3 libx11 libgbm-dev  libxtst6  libxss1

npm install -g yarn
yarn add puppeteer


## Docker Commands

docker compose -f ./docker-compose-dev.yml up


## Knex Commands

npm install knex -g
yarn run up
yarn run down


## Seed DB

knex seed:make --knexfile knexfile.cjs --esm categories
knex seed:run --knexfile knexfile.cjs --esm


## Dev commands utils

FLush Redis
docker exec -it sitescan-redis-1 redis-cli
flushall