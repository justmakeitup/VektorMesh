"""Auto-generated VektorMesh gRPC & Protocol Buffer bindings."""
import sys
from pathlib import Path

_gen_dir = str(Path(__file__).resolve().parent)
if _gen_dir not in sys.path:
    sys.path.insert(0, _gen_dir)

from . import vektormesh_pb2
from . import vektormesh_pb2_grpc

__all__ = ["vektormesh_pb2", "vektormesh_pb2_grpc"]
