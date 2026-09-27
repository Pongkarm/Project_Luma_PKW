/**
 * Studio tools — POST /api/tools/{tool}.
 *
 * Source: FRONTEND_TOOLS_SPECIFICATION.md (v1.0.0, 27 Sep 2026). The backend
 * code behind it is not on any branch yet, so these shapes are the spec's word
 * rather than something checked against a running server.
 */
export type ToolName = 'pose' | 'sketch' | 'color-splash' | 'remove-bg';

/** The two hues the colour-splash filter can keep. */
export type SplashColor = 'green' | 'red';

/** One of MediaPipe's 33 body landmarks. */
export type PoseLandmark = {
  /** 0-32 */
  id: number;
  /** e.g. "NOSE", "LEFT_SHOULDER" */
  name: string;
  /** Relative to the image width, 0-1. */
  x: number;
  /** Relative to the image height, 0-1. */
  y: number;
  /** Relative depth; smaller is nearer the camera. */
  z: number;
  /** Confidence, 0-1. */
  visibility: number;
};

type ToolResponseBase<T extends ToolName, M> = {
  success: boolean;
  tool: T;
  /** Server-relative, e.g. "/api/tools/results/sketch_550e8400.png" */
  result_image_url: string;
  metadata: M;
};

export type PoseResponse = ToolResponseBase<'pose', { total_landmarks: number }> & {
  landmarks: PoseLandmark[];
};

export type SketchResponse = ToolResponseBase<'sketch', { blur_ksize: number }>;

export type ColorSplashResponse = ToolResponseBase<'color-splash', { target_color: SplashColor }>;

export type RemoveBgResponse = ToolResponseBase<'remove-bg', { method: string; iterations: number }> & {
  /** Black-and-white mask, same size as the source — the inpaint canvas can start from it. */
  mask_image_url: string;
};

export type ToolResponse = PoseResponse | SketchResponse | ColorSplashResponse | RemoveBgResponse;

/** Where every tool output is served from. The only prefix the app will fetch. */
export const TOOL_RESULTS_PREFIX = '/api/tools/results/';
