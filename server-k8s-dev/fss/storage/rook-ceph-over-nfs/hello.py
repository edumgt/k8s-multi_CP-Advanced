#!/usr/bin/env python3
import subprocess
import time
from pathlib import Path

OMV_UI = 'http://192.168.56.20'
MOUNT_PATH = Path('/mnt/nfs')
TEST_FILE = MOUNT_PATH / f'hello-py-{int(time.time())}.bin'


def run(cmd: str) -> None:
    print(f"\n$ {cmd}")
    p = subprocess.run(cmd, shell=True, text=True, capture_output=True)
    if p.stdout:
        print(p.stdout.strip())
    if p.stderr:
        print(p.stderr.strip())
    if p.returncode != 0:
        raise SystemExit(p.returncode)


print('hello from nfs-test-hello-py')
print(f'OMV UI: {OMV_UI}')
print(f'NFS mount target: {MOUNT_PATH}')
run('df -h /mnt/nfs')
run(f'dd if=/dev/zero of={TEST_FILE} bs=1M count=32 conv=fsync')
run(f'ls -lh {TEST_FILE}')
run('du -sh /mnt/nfs || true')
print('test finished successfully')
