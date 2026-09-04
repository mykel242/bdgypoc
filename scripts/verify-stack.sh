#!/bin/bash
# Verify the Budgie stack is healthy. Safe to run any time; intended
# particularly after a reboot, because the 2026-09-03 outage was a boot
# failure that nobody noticed for 14 hours.
#
# Exits 0 if everything passes, 1 otherwise, so it can be used as a check.
#
#   scripts/verify-stack.sh                 # check against live state
#   scripts/verify-stack.sh <baseline-file> # also compare data fingerprint
#
# A baseline is written by: scripts/verify-stack.sh --write-baseline <file>

set -uo pipefail

PASS=0
FAIL=0
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }
note() { printf '    %s\n' "$1"; }

fingerprint() {
    podman exec budgie-db psql -U budgie_user -d budgie -tAc "
    select 'users='||(select count(*) from users)
        ||' ledgers='||(select count(*) from ledgers)
        ||' txns='||(select count(*) from transactions)
        ||' users_md5='||(select md5(string_agg(id::text||email||first_name||last_name||is_admin::text,'|' order by id)) from users)
        ||' ledgers_md5='||(select md5(string_agg(id::text||name||starting_balance::text||is_locked::text||is_archived::text,'|' order by id)) from ledgers)
        ||' txns_md5='||(select md5(string_agg(id::text||ledger_id::text||date::text||description||credit_amount::text||debit_amount::text||is_paid::text||is_cleared::text,'|' order by id)) from transactions)
        ||' credit='||(select sum(credit_amount) from transactions)
        ||' debit='||(select sum(debit_amount) from transactions);" 2>/dev/null | tr -d ' \n'
}

if [ "${1:-}" = "--write-baseline" ]; then
    OUT="${2:?usage: --write-baseline <file>}"
    {
        echo "# budgie stack baseline"
        echo "written_at=$(date -Is)"
        echo "boot_id=$(cat /proc/sys/kernel/random/boot_id)"
        echo "fingerprint=$(fingerprint)"
    } > "$OUT"
    echo "baseline written to $OUT"
    cat "$OUT"
    exit 0
fi

BASELINE="${1:-}"

echo "budgie stack verification — $(date -Is)"
echo

# --- did we actually reboot? -------------------------------------------
CUR_BOOT=$(cat /proc/sys/kernel/random/boot_id)
UPTIME_S=$(cut -d' ' -f1 /proc/uptime)
UPTIME=$(awk '{printf "%d min", $1/60}' /proc/uptime)
if [ -n "$BASELINE" ] && [ -f "$BASELINE" ]; then
    OLD_BOOT=$(grep '^boot_id=' "$BASELINE" | cut -d= -f2)
    if [ "$CUR_BOOT" != "$OLD_BOOT" ]; then
        ok "host rebooted since baseline (uptime $UPTIME)"
    else
        bad "SAME boot as baseline — the host has NOT rebooted (uptime $UPTIME)"
    fi
else
    note "no baseline given; uptime $UPTIME"
fi

# --- systemd units -----------------------------------------------------
for u in budgie-network budgie-db budgie-backend budgie-frontend budgie-nginx; do
    s=$(systemctl --user is-active "$u.service" 2>/dev/null)
    [ "$s" = "active" ] && ok "unit $u.service active" || bad "unit $u.service is '$s'"
done

# --- containers --------------------------------------------------------
for c in budgie-db budgie-backend budgie-frontend budgie-nginx; do
    podman ps --format '{{.Names}}' 2>/dev/null | grep -qx "$c" \
        && ok "container $c running" || bad "container $c NOT running"
done
podman healthcheck run budgie-db >/dev/null 2>&1 \
    && ok "budgie-db healthcheck passes" || bad "budgie-db healthcheck FAILS"

# --- prerequisites that only bite after a rebuild ----------------------
podman network exists budgie-network && ok "network budgie-network exists" \
    || bad "network budgie-network missing"
for s in budgie-db-password budgie-session-secret; do
    podman secret ls --format '{{.Name}}' | grep -qx "$s" \
        && ok "secret $s present" || bad "secret $s MISSING"
done

# --- the app itself ----------------------------------------------------
CODE=$(curl -sS -o /dev/null -w '%{http_code}' -L -m 10 http://localhost/ 2>/dev/null)
[ "$CODE" = "200" ] && ok "app responds 200" || bad "app returned '$CODE'"

curl -sS -m 10 http://localhost/api/auth/check 2>/dev/null | grep -q '"authenticated":true' \
    && ok "session auto-establishes (no login)" || bad "session did NOT auto-establish"

LEDGERS=$(curl -sS -m 10 http://localhost/api/ledgers 2>/dev/null \
    | python3 -c "import json,sys;print(len(json.load(sys.stdin).get('ledgers',[])))" 2>/dev/null)
[ -n "$LEDGERS" ] && [ "$LEDGERS" -gt 0 ] 2>/dev/null \
    && ok "API returns data ($LEDGERS ledgers)" || bad "API returned no ledgers"

# --- data integrity ----------------------------------------------------
CUR_FP=$(fingerprint)
if [ -n "$BASELINE" ] && [ -f "$BASELINE" ]; then
    OLD_FP=$(grep '^fingerprint=' "$BASELINE" | cut -d= -f2-)
    if [ "$CUR_FP" = "$OLD_FP" ]; then
        ok "data fingerprint identical to baseline"
    else
        bad "data fingerprint CHANGED"
        note "baseline: $OLD_FP"
        note "current : $CUR_FP"
    fi
else
    note "data: $CUR_FP"
fi

# --- did it come up cleanly, or come up on the retry? ------------------
# A stack that failed at boot and was rescued by RestartSec looks identical
# to a healthy one by every check above. That happened at the 2026-09-04
# reboot: frontend and nginx both died on unresolvable upstreams and only
# recovered 30s later. Everything was green by the time anyone looked.
# Scoped to the first 5 minutes after boot on purpose: a later manual
# `systemctl stop` also logs "Failed with result" (SIGKILL, 137), so a wider
# window would cry wolf every time someone restarts something by hand.
BOOT_EPOCH=$(( $(date +%s) - ${UPTIME_S%%.*} ))
WINDOW_END=$(date -d "@$(( BOOT_EPOCH + 120 ))" '+%Y-%m-%d %H:%M:%S')
BOOT_TS=$(date -d "@${BOOT_EPOCH}" '+%Y-%m-%d %H:%M:%S')
BOOTFAIL=$(journalctl --user --since "$BOOT_TS" --until "$WINDOW_END" --no-pager 2>/dev/null \
    | grep -E 'budgie-(db|backend|frontend|nginx|network)' \
    | grep -cE 'Failed with result|host not found in upstream')
if [ "${BOOTFAIL:-0}" -eq 0 ]; then
    ok "clean boot — no unit failures in the first 2 min"
else
    bad "$BOOTFAIL failure line(s) within 2 min of boot — it restarted its way to healthy"
    note "journalctl --user --since '$BOOT_TS' --until '$WINDOW_END' | grep -E 'Failed|host not found'"
fi

# --- backups still scheduled -------------------------------------------
[ "$(systemctl --user is-active budgie-backup.timer 2>/dev/null)" = "active" ] \
    && ok "budgie-backup.timer active" || bad "budgie-backup.timer NOT active"

echo
if [ "$FAIL" -eq 0 ]; then
    printf '\033[32mALL %d CHECKS PASSED\033[0m\n' "$PASS"
    exit 0
else
    printf '\033[31m%d PASSED, %d FAILED\033[0m\n' "$PASS" "$FAIL"
    echo
    echo "Start here:"
    echo "  systemctl --user status budgie-nginx.service"
    echo "  journalctl --user -u budgie-nginx.service -n 40 --no-pager"
    echo "  podman inspect budgie-nginx --format '{{.State.Error}}'"
    echo "  ss -tlnp | grep ':80 '"
    echo "See docs/RUNBOOK.md."
    exit 1
fi
