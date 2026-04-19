#!/bin/bash
#
# 本地开发控制脚本
# 用法:
#   ./scripts/devctl.sh start
#   ./scripts/devctl.sh stop
#   ./scripts/devctl.sh restart
#   ./scripts/devctl.sh redeploy
#   ./scripts/devctl.sh status
#   ./scripts/devctl.sh logs
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
RUNTIME_DIR="${PROJECT_DIR}/.dev-runtime"
PID_FILE="${RUNTIME_DIR}/waoowaoo-dev.pid"
LOG_FILE="${RUNTIME_DIR}/waoowaoo-dev.log"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "${PROJECT_DIR}"

mkdir -p "${RUNTIME_DIR}"

print_ok() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_err() {
  echo -e "${RED}✗ $1${NC}"
}

print_info() {
  echo -e "${BLUE}▶ $1${NC}"
}

container_name_for_service() {
  case "$1" in
    mysql) echo "waoowaoo-mysql" ;;
    redis) echo "waoowaoo-redis" ;;
    minio) echo "waoowaoo-minio" ;;
    *) return 1 ;;
  esac
}

is_pid_running() {
  local pid="$1"
  [[ -n "${pid}" ]] && kill -0 "${pid}" >/dev/null 2>&1
}

read_pid() {
  if [[ -f "${PID_FILE}" ]]; then
    cat "${PID_FILE}"
  fi
}

cleanup_stale_pid() {
  local pid
  pid="$(read_pid || true)"
  if [[ -n "${pid}" ]] && ! is_pid_running "${pid}"; then
    rm -f "${PID_FILE}"
  fi
}

is_dev_running() {
  cleanup_stale_pid
  local pid
  pid="$(read_pid || true)"
  if [[ -n "${pid}" ]] && is_pid_running "${pid}"; then
    return 0
  fi
  return 1
}

ensure_required_files() {
  if [[ ! -f ".env" ]]; then
    print_err "缺少 .env。请先创建环境文件。"
    exit 1
  fi
}

ensure_dependencies() {
  if [[ ! -d "node_modules" ]]; then
    print_info "未检测到 node_modules，开始安装依赖"
    npm install
  fi
}

start_infra() {
  print_info "启动基础服务 mysql redis minio"
  docker compose up -d mysql redis minio
}

wait_for_service_health() {
  local service="$1"
  local timeout_seconds="${2:-180}"
  local container_name
  local status
  local elapsed=0

  container_name="$(container_name_for_service "${service}")" || {
    print_err "未知服务: ${service}"
    exit 1
  }

  print_info "等待 ${service} 就绪"
  while (( elapsed < timeout_seconds )); do
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_name}" 2>/dev/null || true)"

    case "${status}" in
      healthy|running)
        print_ok "${service} 已就绪"
        return 0
        ;;
      unhealthy)
        print_err "${service} 健康检查失败"
        docker compose logs --tail=80 "${service}" || true
        exit 1
        ;;
    esac

    sleep 2
    elapsed=$((elapsed + 2))
  done

  print_err "等待 ${service} 超时"
  docker compose logs --tail=80 "${service}" || true
  exit 1
}

wait_for_infra() {
  wait_for_service_health mysql
  wait_for_service_health redis
  wait_for_service_health minio
}

sync_schema() {
  print_info "同步 Prisma 表结构"
  npx prisma db push
}

start_dev_process() {
  if is_dev_running; then
    local pid
    pid="$(read_pid)"
    print_warn "开发服务已在运行，PID=${pid}"
    return 0
  fi

  print_info "启动 npm run dev"
  nohup setsid bash -lc "cd \"${PROJECT_DIR}\" && exec npm run dev" > "${LOG_FILE}" 2>&1 < /dev/null &
  local pid=$!
  echo "${pid}" > "${PID_FILE}"
  sleep 3

  if is_pid_running "${pid}"; then
    print_ok "开发服务已启动，PID=${pid}"
    print_ok "日志文件: ${LOG_FILE}"
  else
    rm -f "${PID_FILE}"
    print_err "开发服务启动失败，请查看日志: ${LOG_FILE}"
    exit 1
  fi
}

stop_pid_process() {
  local pid
  pid="$(read_pid || true)"
  if [[ -n "${pid}" ]] && is_pid_running "${pid}"; then
    print_info "停止开发服务，PID=${pid}"
    # npm run dev is started in a new session; stop the whole process group first
    # so concurrently children cannot keep writing to the old log file.
    kill -- "-${pid}" >/dev/null 2>&1 || true
    kill "${pid}" >/dev/null 2>&1 || true

    for _ in {1..15}; do
      if ! is_pid_running "${pid}"; then
        break
      fi
      sleep 1
    done

    if is_pid_running "${pid}"; then
      print_warn "常规停止超时，强制结束 PID=${pid}"
      kill -9 -- "-${pid}" >/dev/null 2>&1 || true
      kill -9 "${pid}" >/dev/null 2>&1 || true
    fi
  fi
  rm -f "${PID_FILE}"
}

find_project_dev_pids() {
  local pid
  local cwd
  local cmd
  local patterns=(
    "npm run dev"
    "npm run dev:next"
    "npm run dev:worker"
    "npm run dev:watchdog"
    "npm run dev:board"
    "concurrently --kill-others"
    "next dev -H 0.0.0.0"
    "next dev --turbopack -H 0.0.0.0"
    "node_modules/.bin/next dev"
    "tsx watch --env-file=.env src/lib/workers/index.ts"
    "tsx watch --env-file=.env scripts/watchdog.ts"
    "tsx watch --env-file=.env scripts/bull-board.ts"
    "src/lib/workers/index.ts"
    "scripts/watchdog.ts"
    "scripts/bull-board.ts"
  )

  for pattern in "${patterns[@]}"; do
    while read -r pid; do
      [[ -n "${pid}" ]] || continue
      [[ "${pid}" == "$$" ]] && continue
      cwd="$(readlink "/proc/${pid}/cwd" 2>/dev/null || true)"
      cmd="$(tr '\0' ' ' < "/proc/${pid}/cmdline" 2>/dev/null || true)"
      if [[ "${cwd}" == "${PROJECT_DIR}" || "${cmd}" == *"${PROJECT_DIR}"* ]]; then
        echo "${pid}"
      fi
    done < <(pgrep -f "${pattern}" 2>/dev/null || true)
  done | sort -u
}

stop_fallback_processes() {
  local pids
  pids="$(find_project_dev_pids || true)"
  if [[ -z "${pids}" ]]; then
    return 0
  fi

  print_info "清理残留开发进程"
  while read -r pid; do
    [[ -n "${pid}" ]] || continue
    kill -- "-${pid}" >/dev/null 2>&1 || true
    kill "${pid}" >/dev/null 2>&1 || true
  done <<< "${pids}"

  for _ in {1..8}; do
    if [[ -z "$(find_project_dev_pids || true)" ]]; then
      return 0
    fi
    sleep 1
  done

  print_warn "残留开发进程常规停止超时，强制清理"
  pids="$(find_project_dev_pids || true)"
  while read -r pid; do
    [[ -n "${pid}" ]] || continue
    kill -9 -- "-${pid}" >/dev/null 2>&1 || true
    kill -9 "${pid}" >/dev/null 2>&1 || true
  done <<< "${pids}"
}

stop_dev_process() {
  local was_running="false"
  if is_dev_running; then
    was_running="true"
  fi

  stop_pid_process
  stop_fallback_processes

  if [[ "${was_running}" == "true" ]]; then
    print_ok "开发服务已停止"
  else
    print_warn "未检测到受管开发服务，已执行兜底清理"
  fi
}

show_status() {
  echo
  echo "waoowaoo 本地开发状态"
  echo "项目目录: ${PROJECT_DIR}"
  echo

  if is_dev_running; then
    echo "应用状态: 运行中 (PID $(read_pid))"
  else
    echo "应用状态: 未运行"
  fi

  echo
  docker compose ps
  echo
  echo "访问地址:"
  echo "  应用: http://localhost:3000"
  echo "  队列面板: http://localhost:3010/admin/queues"
  echo "  MinIO Console: http://localhost:19001"
  echo
}

show_logs() {
  if [[ ! -f "${LOG_FILE}" ]]; then
    print_warn "日志文件不存在: ${LOG_FILE}"
    exit 0
  fi
  tail -f "${LOG_FILE}"
}

start_all() {
  ensure_required_files
  ensure_dependencies
  start_infra
  wait_for_infra
  sync_schema
  start_dev_process
}

restart_all() {
  stop_dev_process
  start_all
}

redeploy_all() {
  print_info "重新部署本地开发环境"
  stop_dev_process
  print_info "重建基础服务容器"
  docker compose up -d --force-recreate mysql redis minio
  wait_for_infra
  sync_schema
  start_dev_process
}

COMMAND="${1:-status}"

case "${COMMAND}" in
  start)
    start_all
    ;;
  stop)
    stop_dev_process
    ;;
  restart)
    restart_all
    ;;
  redeploy)
    redeploy_all
    ;;
  status)
    show_status
    ;;
  logs)
    show_logs
    ;;
  *)
    echo "未知命令: ${COMMAND}"
    echo "用法: ./scripts/devctl.sh {start|stop|restart|redeploy|status|logs}"
    exit 1
    ;;
esac
