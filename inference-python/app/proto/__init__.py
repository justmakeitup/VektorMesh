"""Auto-generated and exported Protocol Buffer stubs for VektorMesh."""
import sys
from pathlib import Path

# Ensure local package directory is in sys.path so generated grpc stubs can import siblings directly
_proto_dir = str(Path(__file__).resolve().parent)
if _proto_dir not in sys.path:
    sys.path.insert(0, _proto_dir)

from . import vektormesh_pb2
from . import vektormesh_pb2_grpc

__all__ = ["vektormesh_pb2", "vektormesh_pb2_grpc"]
