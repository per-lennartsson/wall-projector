FROM nginx:alpine

COPY index.html style.css app.js VERSION /usr/share/nginx/html/

# Bake the VERSION file's contents into app.js at image-build time, so the
# running app can show exactly which build it is without needing shell
# access to the container (docker exec/inspect work too, via the VERSION
# file itself or `docker image inspect --format '{{.Created}}'`).
RUN sed -i "s/__APP_VERSION__/$(cat /usr/share/nginx/html/VERSION | tr -d '[:space:]')/" /usr/share/nginx/html/app.js

EXPOSE 80
