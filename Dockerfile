FROM node:12-alpine

WORKDIR /code
COPY package*.json ./
COPY yarn.lock ./

# Bundle app source
COPY . .


RUN echo "Installing Node Dependencies"
RUN yarn

EXPOSE 3000

CMD ["yarn", "watch"]