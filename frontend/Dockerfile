# Site React — compilé par Node, servi par nginx (aucun Node en production).
# Construire depuis le dossier frontend :  docker build -t naissances-web ./frontend

# ---- 1) Compilation ---------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# package*.json d'abord : « npm ci » n'est refait que si les dépendances changent.
COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

# ---- 2) Exécution -----------------------------------------------------------
# Variante « unprivileged » : nginx tourne sans root et écoute sur 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS final

# Adresse de l'API vers laquelle nginx relaie /api (remplacée au démarrage par envsubst).
#  - docker compose : http://api:8080
#  - Azure Container Apps : adresse interne de l'application API
ENV API_URL=http://api:8080

COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
