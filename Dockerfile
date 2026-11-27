# Two images from one file. Build either with --target:
#   docker build --target api -t <name> .
#   docker build --target web -t <name> .
# The build context is the repository root (see .dockerignore).

# ---------------------------------------------------------------- API
FROM mcr.microsoft.com/dotnet/sdk:10.0-noble AS api-build
WORKDIR /src/api
# Restore first, so the packages are cached until the project file changes.
COPY src/api/global.json ./
COPY src/api/IdeaDiscovery.Api/IdeaDiscovery.Api.csproj IdeaDiscovery.Api/
RUN dotnet restore IdeaDiscovery.Api/IdeaDiscovery.Api.csproj
COPY src/api/IdeaDiscovery.Api/ IdeaDiscovery.Api/
RUN dotnet publish IdeaDiscovery.Api/IdeaDiscovery.Api.csproj -c Release --no-restore -o /app

# Ubuntu 24.04 (noble) based, not Alpine: SkiaSharp's native library needs glibc.
# The API refuses to start if its image self-check fails. The tag names the OS on
# purpose, so a new default base image never arrives unannounced.
FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble AS api
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
# The repository's layout is kept, so the client's relative imports resolve: the
# demo code imports ../../../../prompts/interviewer.md (from src/web/src/demo), and the bundler and the type check both
# need that file. None of it reaches the api build's output.
WORKDIR /repo
COPY src/web/package.json src/web/package-lock.json src/web/
RUN npm --prefix src/web ci
COPY prompts prompts
COPY src/web src/web
RUN npm --prefix src/web run build:api

FROM caddy:2 AS web
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /repo/src/web/dist /srv
