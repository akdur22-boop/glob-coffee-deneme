# Build stage: export Expo web bundle to static files
FROM node:20-slim AS build

WORKDIR /app

# Backend URL is baked into the web bundle at build time (EXPO_PUBLIC_*)
ARG EXPO_PUBLIC_BACKEND_URL
ENV EXPO_PUBLIC_BACKEND_URL=$EXPO_PUBLIC_BACKEND_URL

# NOTE: package-lock.json is out of sync with package.json (qrcode/svg deps
# added without relocking), so use `npm install` instead of the stricter `npm ci`.
COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npx expo export --platform web --output-dir dist

# Serve stage: static files via nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
