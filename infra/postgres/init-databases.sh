#!/bin/sh
set -eu
# PostgreSQL runs this only when the data volume is initialized for the first time.
for db in kabiru_auth kabiru_users kabiru_learning kabiru_progress kabiru_ai; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --command "SELECT 'CREATE DATABASE ' || quote_ident('$db') WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')" \
    | grep -q 'CREATE DATABASE' && psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --command "CREATE DATABASE $db" || true
done
