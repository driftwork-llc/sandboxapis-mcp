# The SandboxAPIs MCP server in a container.
#
# It speaks MCP over stdio and reads the hosted service over HTTPS. It holds no
# data of its own, so the image is the npm package and nothing else.
#
#   docker build -t sandboxapis-mcp .
#   docker run -i --rm sandboxapis-mcp
#
# A key is optional. It lifts the anonymous limit of 60 requests an hour to 600:
#
#   docker run -i --rm -e SANDBOXAPIS_API_KEY=sk_live_... sandboxapis-mcp
#
# Point one surface at a pinned snapshot host for assertions that do not drift:
#
#   docker run -i --rm \
#     -e SANDBOXAPIS_BASE_URL_GITHUB=https://gh-2026-03-g12.snap.sandboxapis.dev \
#     sandboxapis-mcp

FROM node:22-alpine

# Pinned on purpose. An MCP catalog entry that floats on `latest` changes what it
# serves without anybody reviewing the change.
ARG MCP_VERSION=0.3.14

RUN npm install -g "@sandboxapis/mcp@${MCP_VERSION}" \
  && npm cache clean --force

USER node
ENTRYPOINT ["sandboxapis-mcp"]
