import struct
from pathlib import Path
for p in sorted(Path("figures").glob("*.png")):
    data = p.read_bytes()
    w, h = struct.unpack(">II", data[16:24])
    print(f"{p.name} {w}x{h} {w/h:.4f}")
