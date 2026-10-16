FROM node:22.23.1-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run typecheck && npm run build

FROM grafana/grafana:13.1.0
COPY --from=build --chown=grafana:root /app/dist /opt/innertracker/plugins/atharphy-cmsitinnertracker3d-panel
COPY provisioning/datasources /etc/grafana/provisioning/datasources
COPY provisioning/dashboards/provider.yaml /etc/grafana/provisioning/dashboards/innertracker.yaml
COPY provisioning/dashboards/cmsit-inner-tracker-3d.json /opt/innertracker/dashboards/cmsit-inner-tracker-3d.json
ENV GF_PATHS_PLUGINS=/opt/innertracker/plugins
ENV GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=atharphy-cmsitinnertracker3d-panel
