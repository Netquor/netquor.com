#!/bin/sh
# Container entrypoint (runs under tini). On the first start of the web container it puts the seed prices
# into the data volume if no price file exists yet, so the file the operator looks at is the one in force.
# It never overwrites an existing prices.json (or a surviving prices.prev.json): the volume wins over the image.
# The worker sets SEED_DATA=0 and has no data volume.
set -eu
dir="${PRICES_DIR:-/data}"
seed="${PRICES_SEED_FILE:-/app/server/data/prices.seed.json}"
if [ "${SEED_DATA:-1}" = "1" ] && [ -d "$dir" ] && [ -w "$dir" ] && [ -f "$seed" ] \
	&& [ ! -e "$dir/prices.json" ] && [ ! -e "$dir/prices.prev.json" ]; then
	tmp="$dir/.prices.seed.$$"
	cp "$seed" "$tmp" && chmod 0640 "$tmp" && mv "$tmp" "$dir/prices.json"
	echo "entrypoint: seeded $dir/prices.json from the image seed"
fi
exec "$@"
