"""
Asynchronous gRPC Servicer (app/grpc_server/servicer.py)
Implements AnomalyInferenceServiceServicer for unary and bi-directional streaming evaluation.
"""

from typing import AsyncIterator
import grpc
import structlog

from app.generated.vektormesh_pb2 import TelemetryFrame, AnomalyVerdict
from app.generated.vektormesh_pb2_grpc import AnomalyInferenceServiceServicer
from app.models.dual_detector import DualDetector

logger = structlog.get_logger("vektormesh.grpc_servicer")


class AnomalyInferenceServicer(AnomalyInferenceServiceServicer):
    """
    Asynchronous gRPC servicer implementing the AnomalyInferenceService contract.
    """

    def __init__(self, detector: DualDetector):
        self.detector = detector

    async def EvaluateSingleFrame(
        self,
        request: TelemetryFrame,
        context: grpc.aio.ServicerContext
    ) -> AnomalyVerdict:
        """
        Processes a single TelemetryFrame unary RPC and returns the AnomalyVerdict.
        """
        try:
            verdict = self.detector.evaluate_frame(request)
            return verdict
        except Exception as e:
            logger.error("Error in EvaluateSingleFrame", service_id=request.service_id, error=str(e))
            await context.abort(grpc.StatusCode.INTERNAL, f"Inference evaluation failed: {str(e)}")

    async def EvaluateTelemetryStream(
        self,
        request_iterator: AsyncIterator[TelemetryFrame],
        context: grpc.aio.ServicerContext
    ) -> AsyncIterator[AnomalyVerdict]:
        """
        Bi-directional streaming RPC. Continuously ingests streaming TelemetryFrames
        from upstream sidecars or the Java Execution Engine and yields real-time AnomalyVerdicts.
        """
        logger.info("Telemetry stream established with client")
        frame_count = 0
        try:
            async for frame in request_iterator:
                verdict = self.detector.evaluate_frame(frame)
                frame_count += 1
                yield verdict

                if frame_count % 100 == 0:
                    logger.debug("Telemetry frames processed in stream", count=frame_count, service_id=frame.service_id)
        except Exception as e:
            logger.error("Error in EvaluateTelemetryStream", frames_processed=frame_count, error=str(e))
            await context.abort(grpc.StatusCode.INTERNAL, f"Stream processing failed: {str(e)}")
        finally:
            logger.info("Telemetry stream completed/closed", total_frames=frame_count)
