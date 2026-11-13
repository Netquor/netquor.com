#!/usr/bin/env bash
# Container smoke test: builds the image (native architecture, see PLATFORM below), runs web and worker on a throwaway network with a throwaway volume,
# a tiny fake pricing API and two throwaway Caddys that mimic the edge routing, asserts the behaviour that matters, then
# removes everything it created (containers, network, volume). Touches nothing else on this machine and no remote host.
#   bash deploy/smoke.sh                     build and test
#   SKIP_BUILD=1 IMAGE=my:tag bash deploy/smoke.sh   test an image that is already built (CI does this)
set -euo pipefail
SEED_VERSION=$(grep -m1 -o '"version": *[0-9]*' "$PWD/server/data/prices.seed.json" | grep -o '[0-9]*$')
export SEED_VERSION
cd "$(dirname "$0")/.."

IMAGE=${IMAGE:-netquor-com-web:smoke}
RUN="nqsmoke-$$"
NET="$RUN-net"
VOL="$RUN-data"
SECRET="smoke-test-secret-0123456789abcdef"
# The image is published for linux/amd64 and CI runs this on an amd64 runner. On Apple silicon Docker would run an amd64
# image under qemu, where Bun itself crashes (JavaScriptCore aborts at start-up: a qemu limitation, not the image), so the
# default is the machine's own architecture. Override with PLATFORM=linux/amd64.
case "${PLATFORM:-}" in "") case "$(uname -m)" in x86_64|amd64) PLATFORM=linux/amd64 ;; *) PLATFORM=linux/arm64 ;; esac ;; esac
TMP=$(mktemp -d)
FAILED=0

say() { printf '\n== %s\n' "$*"; }
ok()  { printf '  ok    %s\n' "$*"; }
bad() { printf '  FAIL  %s\n' "$*"; FAILED=1; }

cleanup() {
	docker rm -f "$RUN-web" "$RUN-worker" "$RUN-fakeapi" "$RUN-edge-t" "$RUN-edge-u" "$RUN-client" >/dev/null 2>&1 || true
	docker network rm "$NET" >/dev/null 2>&1 || true
	docker volume rm "$VOL" >/dev/null 2>&1 || true
	rm -rf "$TMP"
}
trap cleanup EXIT

if [ "${SKIP_BUILD:-0}" != 1 ]; then
	say "build $IMAGE ($PLATFORM)"
	docker build --platform "$PLATFORM" -t "$IMAGE" .
fi

say "throwaway network, volume and containers ($RUN)"
docker network create "$NET" >/dev/null
docker volume create "$VOL" >/dev/null
SUBNET=$(docker network inspect -f '{{(index .IPAM.Config 0).Subnet}}' "$NET")
echo "  network $NET $SUBNET, volume $VOL"

sed "s|#TRUST trusted_proxies static SUBNET|trusted_proxies static $SUBNET|" deploy/smoke/Caddyfile.mimic >"$TMP/Caddyfile.trusted"
cp deploy/smoke/Caddyfile.mimic "$TMP/Caddyfile.untrusted"
chmod 0755 "$TMP"; chmod 0644 "$TMP"/Caddyfile.*

# the web container, run the way deploy/docker-compose.yml runs it: no published ports, data volume, secret in the environment
docker run -d --platform "$PLATFORM" --name "$RUN-web" --network "$NET" --network-alias netquor-web \
	-v "$VOL:/data" -e PRICING_WEBHOOK_SECRET="$SECRET" -e ALLOWED_ORIGINS=https://www.netquor.com,https://netquor.com \
	-e DATA_DIR=/data "$IMAGE" >/dev/null

wait_healthy() { # name, seconds
	local end=$((SECONDS + $2)) s=""
	while [ $SECONDS -lt $end ]; do
		s=$(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null || echo gone)
		[ "$s" = healthy ] && return 0
		sleep 1
	done
	echo "  $1 health: $s"; return 1
}
say "web becomes healthy (Docker HEALTHCHECK on /health)"
if wait_healthy "$RUN-web" 90; then ok "web healthy"; else bad "web did not become healthy"; docker logs "$RUN-web" 2>&1 | tail -20; exit 1; fi

# two throwaway edges: one trusts this network as a proxy (like the real edge trusts Cloudflare), one does not
docker run -d --name "$RUN-edge-t" --network "$NET" --network-alias edge-trusted -v "$TMP/Caddyfile.trusted:/etc/caddy/Caddyfile:ro" caddy:2-alpine >/dev/null
docker run -d --name "$RUN-edge-u" --network "$NET" --network-alias edge-untrusted -v "$TMP/Caddyfile.untrusted:/etc/caddy/Caddyfile:ro" caddy:2-alpine >/dev/null

# a tiny fake pricing API; the worker shares its network namespace so it can use plain http://127.0.0.1 (the validator allows http only to loopback)
docker run -d --platform "$PLATFORM" --name "$RUN-fakeapi" --network "$NET" --network-alias fakeapi --entrypoint bun \
	-v "$PWD/deploy/smoke:/smoke:ro" "$IMAGE" /smoke/fakeapi.ts >/dev/null

drive() { # phase
	docker run --rm --platform "$PLATFORM" --name "$RUN-client" --network "$NET" --entrypoint bun -e SMOKE_SECRET="$SECRET" -e SEED_VERSION="$SEED_VERSION" \
		-v "$PWD/deploy/smoke:/smoke:ro" "$IMAGE" /smoke/driver.ts "$1" || FAILED=1
}

say "web, edge mimic and the image"
drive boot
if [ -n "$(docker port "$RUN-web")" ]; then bad "web publishes ports: $(docker port "$RUN-web")"; else ok "web publishes no ports"; fi
uid=$(docker exec "$RUN-web" id -u)
[ "$uid" != 0 ] && ok "web runs as uid $uid (not root)" || bad "web runs as root"
docker exec "$RUN-web" sh -c "test -f /data/prices.json && grep -q '\"version\": $SEED_VERSION' /data/prices.json" && ok "first start seeded /data/prices.json from the image seed" || bad "no seeded /data/prices.json"
docker exec "$RUN-web" sh -c 'test -f /app/legacy/favicon.svg && test -f /app/legacy/brand/og.png && test -f /app/legacy/cost-calc.js && test -f /app/legacy/llms.template.txt && ! ls /app | grep -q "^\.env" && ! test -e /app/server/.env' && ok "images, calculator scripts and the llms template are in the image; no .env in it" || bad "image contents wrong"
# no hand-written page, stylesheet or behavior script in the image: only the three calculator scripts are JavaScript at the top level
leftover=$(docker exec "$RUN-web" sh -c 'cd /app/legacy && find . -type f \( -name "*.html" -o -name "*.css" -o -name "*.js" \) | sort | grep -v -x -e ./subnet-calc.js -e ./cost-calc.js -e ./bundle-calc.js || true')
[ -z "$leftover" ] && ok "no legacy HTML, CSS or behavior script in the image (only the three calculator scripts)" || bad "unexpected files in /app/legacy: $leftover"

say "worker delivers the API's snapshot to web (backup path)"
docker run -d --platform "$PLATFORM" --name "$RUN-worker" --network "container:$RUN-fakeapi" \
	-e PRICING_WEBHOOK_SECRET="$SECRET" -e PRICING_API_URL=http://127.0.0.1:9100/prices -e PRICING_API_TOKEN=smoke-api-token \
	-e PRICING_POLL_SECONDS=60 -e WEB_INTERNAL_URL=http://netquor-web:3000 -e SEED_DATA=0 --no-healthcheck \
	"$IMAGE" bun server/src/worker.ts >/dev/null
drive worker

say "signed webhook (primary path), then a restart of web"
drive webhook
docker restart "$RUN-web" >/dev/null
wait_healthy "$RUN-web" 90 && ok "web healthy again after docker restart" || bad "web not healthy after restart"
drive persisted

say "lead form, honeypot, client address"
drive lead
lines=$(docker exec "$RUN-web" sh -c 'cat /data/leads.jsonl 2>/dev/null' | grep -c 'smoke@example.com' || true)
[ "$lines" = 1 ] && ok "exactly one lead line for smoke@example.com in the volume" || bad "lead lines for smoke@example.com: $lines"
bots=$(docker exec "$RUN-web" sh -c 'cat /data/leads.jsonl' | grep -c 'bot@example.com' || true)
[ "$bots" = 0 ] && ok "the honeypot post stored nothing" || bad "honeypot stored $bots line(s)"
mode=$(docker exec "$RUN-web" stat -c %a /data/leads.jsonl)
[ "$mode" = 600 ] && ok "leads.jsonl is mode 600" || bad "leads.jsonl mode is $mode"

say "worker heartbeat (waits for its second poll, up to 100 s)"
drive heartbeat
docker logs "$RUN-worker" 2>&1 | sed 's/^/  worker: /' | tail -5
if docker logs "$RUN-worker" 2>&1 | grep -q "$SECRET"; then bad "the secret appears in the worker log"; else ok "no secret in the worker log"; fi
if docker logs "$RUN-web" 2>&1 | grep -q "$SECRET"; then bad "the secret appears in the web log"; else ok "no secret in the web log"; fi

say "clean shutdown on SIGTERM (docker stop)"
for c in worker web; do
	start=$SECONDS
	docker stop -t 20 "$RUN-$c" >/dev/null
	code=$(docker inspect -f '{{.State.ExitCode}}' "$RUN-$c")
	took=$((SECONDS - start))
	{ [ "$code" = 0 ] && [ "$took" -lt 15 ]; } && ok "$c stopped in ${took}s with exit code 0" || bad "$c stop: exit $code after ${took}s"
done

say "teardown"
trap - EXIT
cleanup
left=$(docker ps -a --format '{{.Names}}' | grep -c "$RUN" || true)
vols=$(docker volume ls -q | grep -c "$RUN" || true)
nets=$(docker network ls --format '{{.Name}}' | grep -c "$RUN" || true)
[ "$left$vols$nets" = "000" ] && ok "no containers, volumes or networks left behind" || bad "left behind: containers $left volumes $vols networks $nets"

if [ "$FAILED" = 0 ]; then echo; echo "SMOKE PASSED"; else echo; echo "SMOKE FAILED"; exit 1; fi
