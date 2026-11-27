# Two images from one file. Build either with --target:
#   docker build --target api -t <name> .
#   docker build --target web -t <name> .
# The build context is the repository root (see .dockerignore).

# ---------------------------------------------------------------- API
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src/api
# Restore first, so the packages are cached until the project file changes.
COPY src/api/global.json ./
COPY src/api/IdeaDiscovery.Api/IdeaDiscovery.Api.csproj IdeaDiscovery.Api/
RUN dotnet restore IdeaDiscovery.Api/IdeaDiscovery.Api.csproj
COPY src/api/IdeaDiscovery.Api/ IdeaDiscovery.Api/
RUN dotnet publish IdeaDiscovery.Api/IdeaDiscovery.Api.csproj -c Release --no-restore -o /app

# Debian-based, not Alpine: SkiaSharp's native library needs glibc. The API
# refuses to start if its image self-check fails.
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS api
WORKDIR /app
COPY --from=api-build /app ./
# /data holds the SQLite file, the Data Protection keys and the pre-update
# copies. Only the app user may enter it. (On the server a host folder is
# mounted here; see deploy/docker-compose.yml.)
RUN mkdir /data && chown "$APP_UID" /data && chmod 0700 /data
USER $APP_UID
# The image listens on 8080. umask 077 makes every file the app creates 0600.
EXPOSE 8080
ENTRYPOINT ["sh", "-c", "umask 077 && exec dotnet IdeaDiscovery.Api.dll"]

# ---------------------------------------------------------------- Web
FROM node:24-slim AS web-build
WORKDIR /src
COPY src/web/package.json src/web/package-lock.json web/
RUN npm --prefix web ci
# The type check also reads prompts/ (the demo's scripted lines), so it is copied;
# none of it reaches the api build's output.
COPY prompts prompts
COPY src/web web
RUN npm --prefix web run build:api

FROM caddy:2 AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /src/web/dist /srv
