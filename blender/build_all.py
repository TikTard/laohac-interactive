"""Build every game asset into public/models.

  "D:\\Blender 5.2\\blender.exe" --background --python blender/build_all.py
  "D:\\Blender 5.2\\blender.exe" --background --python blender/build_all.py -- characters   (only one module)
"""
import os, sys, importlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
OUT = os.path.join(os.path.dirname(HERE), "public", "models")

only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
for mod in ("characters", "environment"):
    if only and mod not in only:
        continue
    m = importlib.import_module(mod)
    m.build_all(OUT)
print("ALL DONE")
