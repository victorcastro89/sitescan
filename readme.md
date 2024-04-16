PG_HOST=db
PG_DATABASE=postgres
PG_USER=docker
PG_PASSWORD=docker

sudo apt-get update
sudo apt-get install -y wget --no-install-recommends \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
    libgdk-pixbuf2.0-0 libgtk-3-0 libnspr4 libnss3 libx11 libgbm-dev  libxtst6  libxss1

npm install -g yarn
yarn add puppeteer
