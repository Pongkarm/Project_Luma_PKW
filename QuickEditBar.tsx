import React, { useState } from 'react';

interface QuickEditBarProps {
  /** URL ของรูปภาพปัจจุบันที่แสดงบน Result Stage */
  imageUrl: string;
  /** JWT Token จาก localStorage.getItem('luma_token') */
  token?: string;
  /** Callback เมื่อประมวลผลสำเร็จและได้ภาพผลลัพธ์ใหม่ */
  onProcessed?: (newImageUrl: string, tool: string, metadata?: any) => void;
  /** Callback เมื่อได้ Mask สำหรับส่งต่อไปยัง Inpainting Canvas */
  onMaskGenerated?: (maskImageUrl: string) => void;
  /** Base URL ของ Backend (Default: http://localhost:8000) */
  apiBaseUrl?: string;
}

export const QuickEditBar: React.FC<QuickEditBarProps> = ({
  imageUrl,
  token,
  onProcessed,
  onMaskGenerated,
  apiBaseUrl = 'http://localhost:8000',
}) => {
  const [loadingTool, setLoadingTool] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<'green' | 'red'>('green');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getHeaders = () => {
    const authToken = token || localStorage.getItem('luma_token') || '';
    return {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    };
  };

  const handleToolClick = async (tool: 'pose' | 'sketch' | 'color-splash' | 'remove-bg') => {
    if (!imageUrl) return;
    setLoadingTool(tool);
    setErrorMsg(null);

    try {
      const params = new URLSearchParams();
      params.append('image_url', imageUrl);

      if (tool === 'sketch') {
        params.append('blur_ksize', '21');
      } else if (tool === 'color-splash') {
        params.append('target_color', selectedColor);
      }

      const res = await fetch(`${apiBaseUrl}/api/tools/${tool}`, {
        method: 'POST',
        headers: getHeaders(),
        body: params.toString(),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Processing error' }));
        throw new Error(errorData.detail || `HTTP Error ${res.status}`);
      }

      const data = await res.json();

      if (data.success && data.result_image_url) {
        const fullResultUrl = data.result_image_url.startsWith('http')
          ? data.result_image_url
          : `${apiBaseUrl}${data.result_image_url}`;

        onProcessed?.(fullResultUrl, tool, data.metadata);

        // กรณีเป็น Remove BG มี Mask URL ส่งต่อไปยัง Inpaint Canvas
        if (tool === 'remove-bg' && data.mask_image_url) {
          const fullMaskUrl = data.mask_image_url.startsWith('http')
            ? data.mask_image_url
            : `${apiBaseUrl}${data.mask_image_url}`;
          onMaskGenerated?.(fullMaskUrl);
        }
      }
    } catch (err: any) {
      console.error(`Tool ${tool} failed:`, err);
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoadingTool(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-3 bg-slate-900/90 border border-slate-800 rounded-xl backdrop-blur-md shadow-2xl text-white">
      <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
        <span>🎨 Image Processing Studio (4 Features)</span>
        {loadingTool && (
          <span className="text-indigo-400 animate-pulse">
            ⚡ ประมวลผล {loadingTool}...
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* คนที่ 1: MediaPipe Pose */}
        <button
          onClick={() => handleToolClick('pose')}
          disabled={!!loadingTool || !imageUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-50 transition border border-slate-700 hover:border-indigo-500"
          title="สกัดโครงสร้างท่าทาง 33 จุด (Lecture 8)"
        >
          <span>👤</span>
          <span>Detect Pose</span>
        </button>

        {/* คนที่ 2: Pencil Sketch */}
        <button
          onClick={() => handleToolClick('sketch')}
          disabled={!!loadingTool || !imageUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-600 disabled:opacity-50 transition border border-slate-700 hover:border-amber-500"
          title="แปลงเป็นภาพวาดลายเส้นดินสอ Color Dodge (Lecture 9)"
        >
          <span>✏️</span>
          <span>Pencil Sketch</span>
        </button>

        {/* คนที่ 3: Color Splash & Tint */}
        <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg p-0.5">
          <button
            onClick={() => handleToolClick('color-splash')}
            disabled={!!loadingTool || !imageUrl}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md hover:bg-slate-700 active:bg-slate-600 disabled:opacity-50 transition"
            title="ดูดสีเด่นรอบข้างขาวดำ (Lecture 3, Work 5)"
          >
            <span>🎨</span>
            <span>Color Splash</span>
          </button>
          <select
            value={selectedColor}
            onChange={(e) => setSelectedColor(e.target.value as 'green' | 'red')}
            disabled={!!loadingTool}
            className="bg-slate-900 text-xs text-slate-300 rounded px-1.5 py-1 border-0 focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
          >
            <option value="green">🟢 เขียว</option>
            <option value="red">🔴 แดง</option>
          </select>
        </div>

        {/* คนที่ 4: Smart BG Removal */}
        <button
          onClick={() => handleToolClick('remove-bg')}
          disabled={!!loadingTool || !imageUrl}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 transition shadow-lg shadow-indigo-600/20"
          title="ตัดฉากหลัง GrabCut + ส่ง Inpaint Mask (Lecture 10, 11)"
        >
          <span>✂️</span>
          <span>Remove BG & Mask</span>
        </button>
      </div>

      {errorMsg && (
        <div className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/60 rounded px-2.5 py-1 mt-1">
          ⚠️ {errorMsg}
        </div>
      )}
    </div>
  );
};

export default QuickEditBar;
