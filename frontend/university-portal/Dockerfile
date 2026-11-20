# ---- Build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Les variables VITE_* sont intégrées au build
ARG VITE_API_URL
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM=university
ARG VITE_KEYCLOAK_CLIENT_ID=diploma-frontend
ARG VITE_SITE_URL
ARG VITE_SITE_NAME="Registre des diplômes"
ARG VITE_PRIVACY_EMAIL
ARG VITE_TURNSTILE_SITE_KEY
ARG VITE_ANALYTICS_DOMAIN
ARG VITE_LEGAL_DRAFT=false
ARG VITE_INSTITUTION_NAME="Université Mohammed V de Rabat"
ARG VITE_MAX_PDF_MB=10
RUN npm run build

# ---- Exécution (nginx sans privilèges, port 8080) ----
FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080 8443
