import http.server
import socketserver
import subprocess
import sys
import json
import os

PORT = int(os.environ.get("PORT", 8080))
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class MyHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        if self.path == '/api/config':
            try:
                config_path = os.path.join(DIRECTORY, ".cursor", "skills", "Azure", ".ado_config.json")
                has_pat = False
                organization = "metanetsistema"
                project = "Metanet"
                
                if os.path.exists(config_path):
                    with open(config_path, "r", encoding="utf-8") as f:
                        try:
                            config = json.load(f)
                            pat_val = config.get("pat", "")
                            organization = config.get("organization", organization)
                            project = config.get("project", project)
                            # Check if valid PAT (placeholder or empty implies no PAT)
                            has_pat = pat_val and pat_val not in ("SEU_PAT_AQUI", "YOUR_PAT_HERE", "")
                        except Exception:
                            pass
                
                response_data = {
                    "success": True,
                    "has_pat": has_pat,
                    "organization": organization,
                    "project": project
                }
            except Exception as e:
                response_data = {
                    "success": False,
                    "error": str(e)
                }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/sync':
            try:
                # Parse JSON body to get PAT if provided
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length) if content_length > 0 else b""
                pat_val = ""
                if body:
                    try:
                        req_data = json.loads(body.decode('utf-8'))
                        pat_val = req_data.get("pat", "").strip()
                    except Exception:
                        pass
                
                config_path = os.path.join(DIRECTORY, ".cursor", "skills", "Azure", ".ado_config.json")
                
                # If a new PAT was provided, save it to .ado_config.json
                if pat_val:
                    config = {}
                    if os.path.exists(config_path):
                        with open(config_path, "r", encoding="utf-8") as f:
                            try:
                                config = json.load(f)
                            except Exception:
                                pass
                    config["pat"] = pat_val
                    # Ensure organization & project are set to default if not present
                    if "organization" not in config:
                        config["organization"] = "metanetsistema"
                    if "project" not in config:
                        config["project"] = "Metanet"
                        
                    os.makedirs(os.path.dirname(config_path), exist_ok=True)
                    with open(config_path, "w", encoding="utf-8") as f:
                        json.dump(config, f, indent=2, ensure_ascii=False)
                
                # Execute sync_devops.py with --force to skip any prompts
                script_path = os.path.join(DIRECTORY, "sync_devops.py")
                
                # Run python using sys.executable to ensure the same environment
                process = subprocess.run(
                    [sys.executable, script_path, "--force"],
                    capture_output=True,
                    text=True,
                    encoding="utf-8"
                )
                
                status_code = 200 if process.returncode == 0 else 500
                response_data = {
                    "success": process.returncode == 0,
                    "stdout": process.stdout,
                    "stderr": process.stderr,
                    "returncode": process.returncode
                }
            except Exception as e:
                status_code = 500
                response_data = {
                    "success": False,
                    "error": str(e)
                }
                
            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
        elif self.path == '/api/auth':
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                body = self.rfile.read(content_length) if content_length > 0 else b""
                provided_token = ""
                if body:
                    try:
                        req_data = json.loads(body.decode('utf-8'))
                        provided_token = req_data.get("token", "").strip()
                    except Exception:
                        pass

                config_path = os.path.join(DIRECTORY, ".cursor", "skills", "Azure", ".ado_config.json")
                expected_token = "admin123" # Default password
                if os.path.exists(config_path):
                    with open(config_path, "r", encoding="utf-8") as f:
                        try:
                            config = json.load(f)
                            expected_token = config.get("admin_token", expected_token)
                        except Exception:
                            pass

                success = (provided_token == expected_token)
                
                response_data = {
                    "success": success,
                    "role": "admin" if success else "user"
                }
                status_code = 200
            except Exception as e:
                status_code = 500
                response_data = {
                    "success": False,
                    "error": str(e)
                }

            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.end_headers()
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
        else:
            super().do_POST()

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def end_headers(self):
        # Disable caching completely to mirror http-server -c-1
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()

if __name__ == '__main__':
    # Force server to run in UTF-8
    if sys.stdout.encoding != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8")
    
    print(f"Iniciando o servidor em http://localhost:{PORT}")
    print(f"Servindo diretório: {DIRECTORY}")
    
    # Allow port reuse
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    with socketserver.ThreadingTCPServer(("", PORT), MyHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServidor finalizado.")
            httpd.server_close()
