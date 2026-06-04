#!/usr/bin/env python3
"""RubyNotes server — serves static files + real PTY terminals via WebSocket."""
import asyncio, json, os, signal, struct, sys, threading
from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import ThreadingMixIn
import socket, hashlib, base64

if sys.platform == "win32":
    sys.stderr.write(
        "RubyNotes server.py uses Unix pty and is not supported on Windows.\n"
        "On Windows, use the Electron app directly (npm start) which uses node-pty.\n"
    )
    sys.exit(1)

import pty  # noqa: E402  (Unix-only import)

PORT = 8080
WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

class TerminalSession:
    def __init__(self, cli_name, note_context=""):
        self.cli_name = cli_name
        self.note_context = note_context
        self.pid = None
        self.fd = None
        self.reader = None

    async def start(self, websocket):
        self.pid, self.fd = pty.fork()
        if self.pid == 0:
            env = os.environ.copy()
            env["TERM"] = "xterm-256color"
            env["EMERALD_NOTE_CONTEXT"] = self.note_context
            env["EMERALD_CLI"] = self.cli_name
            os.execve("/bin/bash", ["/bin/bash", "--login"], env)
        else:
            self.websocket = websocket
            loop = asyncio.get_event_loop()
            loop.add_reader(self.fd, self._read_pty)
            self._send_welcome()

    def _read_pty(self):
        try:
            data = os.read(self.fd, 4096)
            if data:
                asyncio.ensure_future(self._ws_send(data))
            else:
                self.close()
        except OSError:
            self.close()

    async def _ws_send(self, data):
        try:
            await self.websocket.send(data)
        except Exception:
            self.close()

    def write(self, data):
        if self.fd is not None:
            try:
                os.write(self.fd, data)
            except OSError:
                self.close()

    def _send_welcome(self):
        if self.cli_name and self.cli_name != "shell":
            msg = f"\r\n\033[1;32mRubyNotes Terminal — {self.cli_name}\033[0m\r\n"
            msg += f"\033[90mNote context loaded. Type your command.\033[0m\r\n"
        else:
            msg = "\r\n\033[1;32mRubyNotes Terminal\033[0m\r\n"
        os.write(self.fd, msg.encode())

    def close(self):
        if self.fd:
            try:
                loop = asyncio.get_event_loop()
                loop.remove_reader(self.fd)
            except Exception:
                pass
            try:
                os.close(self.fd)
            except OSError:
                pass
            self.fd = None
        if self.pid:
            try:
                os.kill(self.pid, signal.SIGTERM)
            except OSError:
                pass
            self.pid = None

    def resize(self, rows, cols):
        if self.fd:
            try:
                import fcntl, termios
                winsize = struct.pack("HHHH", rows, cols, 0, 0)
                fcntl.ioctl(self.fd, termios.TIOCSWINSZ, winsize)
            except Exception:
                pass

class WebSocketHandler:
    def __init__(self, reader, writer):
        self.reader = reader
        self.writer = writer
        self.session = None

    async def handle(self):
        request = await self.reader.readline()
        if not request:
            return

        headers = {}
        while True:
            line = await self.reader.readline()
            line = line.decode().strip()
            if not line:
                break
            key, val = line.split(":", 1)
            headers[key.strip().lower()] = val.strip()

        ws_key = headers.get("sec-websocket-key", "")

        path = request.decode().split(" ")[1]

        accept = base64.b64encode(
            hashlib.sha1((ws_key + WS_MAGIC).encode()).digest()
        ).decode()

        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept}\r\n"
            "\r\n"
        )
        self.writer.write(response.encode())
        await self.writer.drain()

        cli_name = "shell"
        if "/ws/" in path:
            parts = path.split("/ws/", 1)[1].split("?")[0]
            if parts:
                cli_name = parts

        self.session = TerminalSession(cli_name)
        await self.session.start(self)
        await self._read_loop()

    async def send(self, data):
        if isinstance(data, str):
            data = data.encode()
        frame = bytearray()
        frame.append(0x82)
        length = len(data)
        if length < 126:
            frame.append(length)
        elif length < 65536:
            frame.append(126)
            frame.extend(struct.pack(">H", length))
        else:
            frame.append(127)
            frame.extend(struct.pack(">Q", length))
        frame.extend(data)
        try:
            self.writer.write(bytes(frame))
            await self.writer.drain()
        except Exception:
            if self.session:
                self.session.close()

    async def _read_loop(self):
        try:
            while True:
                first = await self.reader.readexactly(2)
                opcode = first[1] & 0x0F
                if opcode == 0x8:
                    break
                length = first[1] & 0x7F
                if length == 126:
                    length = struct.unpack(">H", await self.reader.readexactly(2))[0]
                elif length == 127:
                    length = struct.unpack(">Q", await self.reader.readexactly(8))[0]
                mask = await self.reader.readexactly(4)
                payload = bytearray(await self.reader.readexactly(length))
                for i in range(length):
                    payload[i] ^= mask[i % 4]

                msg = bytes(payload).decode()
                try:
                    cmd = json.loads(msg)
                    if cmd.get("type") == "resize":
                        if self.session:
                            self.session.resize(cmd["rows"], cmd["cols"])
                    elif cmd.get("type") == "input":
                        if self.session:
                            self.session.write(cmd["data"].encode())
                except json.JSONDecodeError:
                    pass
        except Exception:
            pass
        finally:
            if self.session:
                self.session.close()

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    allow_reuse_address = True
    daemon_threads = True

async def handle_ws(reader, writer):
    handler = WebSocketHandler(reader, writer)
    await handler.handle()

async def main():
    ws_server = await asyncio.start_server(handle_ws, "0.0.0.0", PORT + 1)
    print(f" Terminal WS server on port {PORT + 1}")

    os.chdir(os.path.dirname(os.path.abspath(__file__)) or ".")

    httpd = ThreadedHTTPServer(("0.0.0.0", PORT), SimpleHTTPRequestHandler)
    http_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    http_thread.start()
    print(f" RubyNotes → http://localhost:{PORT}")
    print(f" CLI terminals: //terminal opencode | codex | qwen | agy | kilo | emerald")

    await ws_server.serve_forever()

if __name__ == "__main__":
    asyncio.run(main())
