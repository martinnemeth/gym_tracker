"""Minimálny Chrome DevTools Protocol klient (bez závislostí)."""
import base64, json, os, socket, struct, subprocess, time, urllib.request

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


class WS:
    def __init__(self, url):
        assert url.startswith("ws://")
        hostport, path = url[5:].split("/", 1)
        host, port = hostport.split(":")
        self.s = socket.create_connection((host, int(port)))
        key = base64.b64encode(os.urandom(16)).decode()
        self.s.sendall((f"GET /{path} HTTP/1.1\r\nHost: {hostport}\r\nUpgrade: websocket\r\n"
                        f"Connection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += self.s.recv(4096)
        self.rest = buf.split(b"\r\n\r\n", 1)[1]

    def _read(self, n):
        while len(self.rest) < n:
            chunk = self.s.recv(1 << 20)
            if not chunk:
                raise EOFError
            self.rest += chunk
        out, self.rest = self.rest[:n], self.rest[n:]
        return out

    def send(self, text):
        data = text.encode()
        hdr = bytearray([0x81])
        n = len(data)
        if n < 126:
            hdr.append(0x80 | n)
        elif n < 65536:
            hdr.append(0x80 | 126); hdr += struct.pack(">H", n)
        else:
            hdr.append(0x80 | 127); hdr += struct.pack(">Q", n)
        mask = os.urandom(4)
        self.s.sendall(bytes(hdr) + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def recv(self):
        msg = b""
        while True:
            b0, b1 = self._read(2)
            n = b1 & 0x7F
            if n == 126:
                n = struct.unpack(">H", self._read(2))[0]
            elif n == 127:
                n = struct.unpack(">Q", self._read(8))[0]
            msg += self._read(n)
            if b0 & 0x80:
                return msg.decode()


class Browser:
    def __init__(self, profile, port=9333, width=390, height=844, dark=False):
        self.proc = subprocess.Popen([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                                      f"--remote-debugging-port={port}", f"--user-data-dir={profile}",
                                      "--no-first-run", "about:blank"],
                                     stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                pages = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json"))
                page = next(p for p in pages if p["type"] == "page")
                break
            except Exception:
                time.sleep(0.2)
        self.ws = WS(page["webSocketDebuggerUrl"])
        self.id = 0
        self.console = []
        self.call("Runtime.enable")
        self.call("Page.enable")
        self.call("Emulation.setDeviceMetricsOverride", width=width, height=height, deviceScaleFactor=2, mobile=True)
        self.call("Emulation.setEmulatedMedia", features=[{"name": "prefers-color-scheme", "value": "dark" if dark else "light"}])

    def call(self, method, **params):
        self.id += 1
        my = self.id
        self.ws.send(json.dumps({"id": my, "method": method, "params": params}))
        while True:
            m = json.loads(self.ws.recv())
            if m.get("method") == "Runtime.consoleAPICalled":
                self.console.append(" ".join(str(a.get("value", a.get("description"))) for a in m["params"]["args"]))
            elif m.get("method") == "Runtime.exceptionThrown":
                d = m["params"]["exceptionDetails"]
                self.console.append("EXC " + (d.get("exception", {}).get("description") or d.get("text")))
            if m.get("id") == my:
                if "error" in m:
                    raise RuntimeError(m["error"])
                return m["result"]

    def eval(self, expr):
        r = self.call("Runtime.evaluate", expression=expr, awaitPromise=True, returnByValue=True)
        if "exceptionDetails" in r:
            raise RuntimeError(r["exceptionDetails"].get("exception", {}).get("description") or r["exceptionDetails"])
        return r["result"].get("value")

    def goto(self, url, wait=1.0):
        self.call("Page.navigate", url=url)
        time.sleep(wait)

    def wait_for(self, js_cond, timeout=8.0):
        end = time.time() + timeout
        while time.time() < end:
            if self.eval(f"!!({js_cond})"):
                return True
            time.sleep(0.1)
        raise TimeoutError(js_cond)

    def screenshot(self, path):
        r = self.call("Page.captureScreenshot", format="png")
        open(path, "wb").write(base64.b64decode(r["data"]))

    def close(self):
        self.proc.terminate()
        self.proc.wait()
