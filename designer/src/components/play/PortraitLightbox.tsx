import React, { useEffect, useState } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Star,
  Trash2,
  Download,
  Copy,
  CheckCheck,
  Sparkles,
  ExternalLink,
} from 'lucide-react';

interface PortraitLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: string;
  entityRole: string;
  images: string[];
  currentImageUrl: string;
  promptText?: string | null;
  onSetActive: (url: string) => void;
  onDeleteImage?: (url: string) => void;
}

export const PortraitLightbox: React.FC<PortraitLightboxProps> = ({
  isOpen,
  onClose,
  entityName,
  entityRole,
  images,
  currentImageUrl,
  promptText,
  onSetActive,
  onDeleteImage,
}) => {
  // Ensure we have a list of images (including currentImageUrl if not already present)
  const allImages = Array.from(new Set([currentImageUrl, ...images].filter(Boolean)));
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const idx = allImages.indexOf(currentImageUrl);
      setSelectedIndex(idx >= 0 ? idx : 0);
    }
  }, [isOpen, currentImageUrl, images]);

  // Keyboard navigation: Escape, ArrowLeft, ArrowRight
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : allImages.length - 1));
      } else if (e.key === 'ArrowRight') {
        setSelectedIndex(prev => (prev < allImages.length - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, allImages.length, onClose]);

  if (!isOpen || allImages.length === 0) return null;

  const activeImage = allImages[selectedIndex] || allImages[0];
  const isPrimary = activeImage === currentImageUrl;

  const handleCopyPrompt = () => {
    if (!promptText) return;
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = activeImage;
    a.download = `${entityName.toLowerCase().replace(/\s+/g, '_')}_portrait.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/60 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-slate-100">{entityName}</h3>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono border border-slate-700 capitalize">
            {entityRole}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {selectedIndex + 1} of {allImages.length}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Set as Active Button */}
          <button
            onClick={() => onSetActive(activeImage)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              isPrimary
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-default'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
          >
            {isPrimary ? (
              <>
                <Check className="w-3.5 h-3.5 text-amber-400" />
                <span>Primary Portrait</span>
              </>
            ) : (
              <>
                <Star className="w-3.5 h-3.5 text-slate-400" />
                <span>Set as Primary</span>
              </>
            )}
          </button>

          {/* Toggle Prompt */}
          {promptText && (
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showPrompt
                  ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Prompt</span>
            </button>
          )}

          {/* Download */}
          <button
            onClick={handleDownload}
            title="Download Image"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          {/* Delete (if multiple images) */}
          {onDeleteImage && allImages.length > 1 && (
            <button
              onClick={() => {
                if (confirm(`Remove this image from ${entityName}'s gallery?`)) {
                  onDeleteImage(activeImage);
                  setSelectedIndex(prev => Math.max(0, prev - 1));
                }
              }}
              title="Delete this image"
              className="p-2 rounded-lg bg-slate-800 hover:bg-red-950/50 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/40 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            title="Close (Esc)"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex-1 relative flex items-center justify-center p-6 overflow-hidden">
        {/* Previous Button */}
        {allImages.length > 1 && (
          <button
            onClick={() => setSelectedIndex(prev => (prev > 0 ? prev - 1 : allImages.length - 1))}
            className="absolute left-6 z-10 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 backdrop-blur-md shadow-2xl transition-all"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Large Image */}
        <div className="max-h-full max-w-full flex items-center justify-center relative select-none">
          <img
            src={activeImage}
            alt={entityName}
            className="max-h-[72vh] max-w-[85vw] object-contain rounded-2xl shadow-2xl border border-slate-800/80"
          />
        </div>

        {/* Next Button */}
        {allImages.length > 1 && (
          <button
            onClick={() => setSelectedIndex(prev => (prev < allImages.length - 1 ? prev + 1 : 0))}
            className="absolute right-6 z-10 p-3 rounded-full bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 backdrop-blur-md shadow-2xl transition-all"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Prompt Overlay Drawer */}
        {showPrompt && promptText && (
          <div className="absolute bottom-6 left-12 right-12 max-w-3xl mx-auto glass-panel p-4 rounded-xl border border-purple-500/40 bg-slate-950/95 shadow-2xl animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Portrait Prompt
              </span>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-900 px-2 py-1 rounded border border-slate-800 transition-colors"
              >
                {copiedPrompt ? <CheckCheck className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedPrompt ? 'Copied' : 'Copy Prompt'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-h-36 overflow-y-auto pr-2 font-sans select-text">
              {promptText}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Filmstrip Gallery Strip */}
      {allImages.length > 1 && (
        <div className="px-6 py-3 border-t border-slate-800/80 bg-slate-950/80 flex items-center justify-center gap-3 overflow-x-auto shrink-0">
          {allImages.map((imgUrl, idx) => {
            const isSelected = idx === selectedIndex;
            const isCurrentPrimary = imgUrl === currentImageUrl;

            return (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`relative w-14 h-14 rounded-xl overflow-hidden shrink-0 transition-all border-2 ${
                  isSelected
                    ? 'border-indigo-500 scale-105 shadow-lg shadow-indigo-500/30'
                    : 'border-slate-800 hover:border-slate-600 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={imgUrl} alt={`thumbnail-${idx}`} className="w-full h-full object-cover" />
                {isCurrentPrimary && (
                  <span className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-slate-950" title="Primary Portrait" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
