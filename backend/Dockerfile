# API .NET 10 — image multi-étapes : on compile avec le SDK (lourd), on exécute avec le runtime (léger).
# Construire depuis le dossier backend :  docker build -t naissances-api ./backend

# ---- 1) Compilation ---------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# D'abord les .csproj seuls : tant qu'ils ne changent pas, Docker réutilise le cache
# du « dotnet restore » (téléchargement NuGet) au lieu de le refaire à chaque build.
COPY Naissances.slnx ./
COPY src/Naissances.Domain/Naissances.Domain.csproj                 src/Naissances.Domain/
COPY src/Naissances.Application/Naissances.Application.csproj       src/Naissances.Application/
COPY src/Naissances.Infrastructure/Naissances.Infrastructure.csproj src/Naissances.Infrastructure/
COPY src/Naissances.Api/Naissances.Api.csproj                       src/Naissances.Api/
RUN dotnet restore src/Naissances.Api/Naissances.Api.csproj

COPY src/ src/
RUN dotnet publish src/Naissances.Api/Naissances.Api.csproj -c Release -o /app --no-restore

# ---- 2) Exécution -----------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

ENV ASPNETCORE_HTTP_PORTS=8080 \
    # Derrière nginx / Azure : lire X-Forwarded-Proto (https) et X-Forwarded-For (IP réelle).
    ASPNETCORE_FORWARDEDHEADERS_ENABLED=true

COPY --from=build /app .

# Jamais root en production : utilisateur « app » fourni par l'image Microsoft.
USER $APP_UID

EXPOSE 8080
ENTRYPOINT ["dotnet", "Naissances.Api.dll"]
