# FigCraft web (storytold/figcraft): build statis WebAssembly, disajikan nginx.
# Ganti versi: ubah VERSION + SHA256 (sha256 zip figcraft-web-*.zip di GitHub release).
FROM nginx:1.27-alpine
ARG VERSION=0.13.1
ARG SHA256=fc2cb8d8fa6b8c3846514f064fc18a5acd3a228609a5cf7332b9f6555057999c
RUN wget -qO /tmp/f.zip "https://github.com/storytold/figcraft/releases/download/v${VERSION}/figcraft-web-${VERSION}.zip" \
  && echo "${SHA256}  /tmp/f.zip" | sha256sum -c - \
  && unzip -q /tmp/f.zip -d /tmp/f \
  && rm -rf /usr/share/nginx/html/* \
  && cp -r /tmp/f/figcraft-web-${VERSION}/. /usr/share/nginx/html/ \
  && rm -rf /tmp/f /tmp/f.zip
