#!/bin/sh
# Starts the server as the unprivileged `node` user.
#
# The container starts as root only long enough to hand the database
# directory to `node`. Images before 5.0 ran as root, so a data volume they
# wrote (retro.db and its -wal/-shm files) is owned by root, and `node`
# couldn't open it (SQLITE_CANTOPEN). When the container is started with
# --user, it is already unprivileged and this step is skipped.
set -e

if [ "$(id -u)" = "0" ]; then
  data_dir=$(dirname "${DB_PATH:-/app/data/retro.db}")
  mkdir -p "$data_dir"
  chown -R node:node "$data_dir"
  exec setpriv --reuid="$(id -u node)" --regid="$(id -g node)" --init-groups "$@"
fi

exec "$@"
