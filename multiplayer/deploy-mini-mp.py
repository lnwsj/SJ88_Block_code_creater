#!/usr/bin/env python3
"""Deploy WebSocket server to sj88-i9-64gb (103.253.75.161)"""
import paramiko
import sys
import time

HOST = '103.253.75.161'
USER = 'root'
PASS = 'Dse54fg8*@@2026'
PORT = 22

def main():
    print(f"Connecting to {HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, PORT, USER, PASS, timeout=15, banner_timeout=30, auth_timeout=30,
                allow_agent=False, look_for_keys=False)
    print("Connected")
    # Check if Node is installed
    inp, outp, errp = ssh.exec_command("node -v && which node && which npm")
    print("Node info:", outp.read().decode().strip())
    # Create directory
    ssh.exec_command("mkdir -p /opt/minicraft-mp")
    # Upload server files via SFTP
    sftp = ssh.open_sftp()
    print("Uploading server.js...")
    sftp.put('/workspace/minicraft-mp/server/server.js', '/opt/minicraft-mp/server.js')
    sftp.put('/workspace/minicraft-mp/server/package.json', '/opt/minicraft-mp/package.json')
    # Upload node_modules (just ws)
    print("Uploading node_modules...")
    sftp.put('/workspace/minicraft-mp/server/package-lock.json', '/opt/minicraft-mp/package-lock.json')
    # Upload ws node_module
    import os
    for f in os.listdir('/workspace/minicraft-mp/server/node_modules'):
        full = os.path.join('/workspace/minicraft-mp/server/node_modules', f)
        remote = os.path.join('/opt/minicraft-mp/node_modules', f)
        if os.path.isdir(full):
            sftp.put(full, remote, recurse=True)
        else:
            try:
                sftp.put(full, remote)
            except Exception as e:
                print(f"  Skip {f}: {e}")
    print("Files uploaded")
    sftp.close()
    # Test: install if needed and start
    inp, outp, errp = ssh.exec_command("cd /opt/minicraft-mp && ls node_modules/ws 2>/dev/null && echo OK || npm install --no-audit 2>&1 | tail -5")
    print("npm check:", outp.read().decode().strip(), errp.read().decode().strip())
    # Kill any existing
    ssh.exec_command("pkill -f 'node.*minicraft' 2>/dev/null; sleep 1")
    # Start server with nohup
    ssh.exec_command("cd /opt/minicraft-mp && nohup node server.js > /var/log/minicraft-mp.log 2>&1 &")
    time.sleep(2)
    # Check status
    inp, outp, errp = ssh.exec_command("ps aux | grep -E 'node.*minicraft' | grep -v grep")
    ps_out = outp.read().decode()
    print("Process status:", ps_out[:200] if ps_out else "Not running")
    inp, outp, errp = ssh.exec_command("cat /var/log/minicraft-mp.log 2>/dev/null")
    print("Log:", outp.read().decode().strip()[:300])
    # Check port
    inp, outp, errp = ssh.exec_command("ss -tlnp 2>/dev/null | grep 3109 || netstat -tlnp 2>/dev/null | grep 3109")
    port_out = outp.read().decode()
    print("Port 3109:", port_out[:200] if port_out else "NOT LISTENING")
    # Test connection from VPS
    inp, outp, errp = ssh.exec_command("curl -s -m 3 http://localhost:3109 2>&1 | head -3")
    print("Curl test:", outp.read().decode()[:200])
    # Check if firewall blocks 3109
    inp, outp, errp = ssh.exec_command("iptables -L -n 2>/dev/null | head -20; ufw status 2>/dev/null | head -10")
    print("Firewall:", outp.read().decode()[:300])
    ssh.close()

if __name__ == '__main__':
    main()
