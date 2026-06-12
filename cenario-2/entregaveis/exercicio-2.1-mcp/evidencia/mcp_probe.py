#!/usr/bin/env python3
"""
mcp_probe.py — driver mínimo de JSON-RPC sobre stdio para exercitar MCP servers locais.

Uso:
    python3 mcp_probe.py '<comando>' '<arg1>' '<arg2>' ... -- <requests.json>

Onde <requests.json> é um arquivo com uma lista de objetos {"method":..., "params":...}
que serão enviados, em ordem, APÓS o handshake (initialize + notifications/initialized).

O transporte stdio do MCP usa mensagens JSON delimitadas por nova linha.
Este driver NÃO é o produto final — é o instrumento que gera a evidência de execução
real dos servers (Tarefa 3 do exercício Dev 2.1).
"""
import json
import subprocess
import sys
import threading


def reader(proc, responses, done):
    for line in proc.stdout:
        line = line.strip()
        if not line:
            continue
        try:
            responses.append(json.loads(line))
        except json.JSONDecodeError:
            responses.append({"_raw_non_json": line})
    done.set()


def main():
    argv = sys.argv[1:]
    if "--" not in argv:
        print("uso: mcp_probe.py <cmd> [args...] -- <requests.json>", file=sys.stderr)
        sys.exit(2)
    sep = argv.index("--")
    cmd = argv[:sep]
    requests_file = argv[sep + 1]
    with open(requests_file) as f:
        extra_requests = json.load(f)

    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        bufsize=1,
    )
    responses = []
    done = threading.Event()
    threading.Thread(target=reader, args=(proc, responses, done), daemon=True).start()

    def send(obj):
        proc.stdin.write(json.dumps(obj) + "\n")
        proc.stdin.flush()

    # 1) handshake
    send({
        "jsonrpc": "2.0", "id": 1, "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "mcp-probe", "version": "0.1"},
        },
    })
    send({"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}})

    # 2) requests do exercício
    for i, req in enumerate(extra_requests, start=2):
        send({"jsonrpc": "2.0", "id": i, "method": req["method"], "params": req.get("params", {})})

    # 3) aguarda respostas com id (1 = initialize + uma por request) até o deadline.
    import time
    expected_ids = 1 + len(extra_requests)
    deadline = time.monotonic() + 40  # tolera cold start do npx/uvx
    while time.monotonic() < deadline:
        got = sum(1 for r in responses if isinstance(r, dict) and "id" in r)
        if got >= expected_ids:
            break
        time.sleep(0.2)
    try:
        proc.stdin.close()
    except Exception:
        pass
    proc.terminate()
    done.wait(timeout=2)

    for r in responses:
        print(json.dumps(r, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
