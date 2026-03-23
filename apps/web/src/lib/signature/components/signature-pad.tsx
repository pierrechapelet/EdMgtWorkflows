'use client';

import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

export interface SignatureValue {
  mode: 'drawn' | 'typed';
  imageBase64?: string;  // drawn mode: PNG base64 (without data: prefix)
  typedName?: string;    // typed mode
}

interface SignaturePadProps {
  value: SignatureValue | null;
  onChange: (value: SignatureValue | null) => void;
  readOnly?: boolean;
}

export function SignaturePad({ value, onChange, readOnly = false }: SignaturePadProps) {
  const [mode, setMode] = useState<'drawn' | 'typed'>(value?.mode ?? 'drawn');
  const [typedName, setTypedName] = useState(value?.typedName ?? '');
  const canvasRef = useRef<SignatureCanvas>(null);

  function handleCanvasEnd() {
    if (!canvasRef.current || canvasRef.current.isEmpty()) return;
    // Extract PNG as base64 without the data:image/png;base64, prefix
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    onChange({ mode: 'drawn', imageBase64: base64 });
  }

  function handleClearCanvas() {
    canvasRef.current?.clear();
    onChange(null);
  }

  function handleTypedChange(name: string) {
    setTypedName(name);
    onChange(name.trim() ? { mode: 'typed', typedName: name.trim() } : null);
  }

  function switchMode(newMode: 'drawn' | 'typed') {
    setMode(newMode);
    onChange(null);
    setTypedName('');
    canvasRef.current?.clear();
  }

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      {!readOnly && (
        <div className="flex gap-1 rounded-md border p-1 w-fit">
          {(['drawn', 'typed'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors capitalize ${
                mode === m
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent'
              }`}
            >
              {m === 'drawn' ? '✍ Draw' : 'Aa Type'}
            </button>
          ))}
        </div>
      )}

      {/* Read-only view */}
      {readOnly && value && (
        <div className="rounded-md border bg-muted/40 p-3">
          {value.mode === 'drawn' && value.imageBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${value.imageBase64}`}
              alt="Signature"
              className="max-h-24 object-contain"
            />
          ) : (
            <p className="font-signature text-xl italic text-foreground">{value.typedName}</p>
          )}
        </div>
      )}

      {/* Drawn mode canvas */}
      {!readOnly && mode === 'drawn' && (
        <div className="space-y-2">
          <div className="rounded-md border bg-white overflow-hidden">
            <SignatureCanvas
              ref={canvasRef}
              penColor="black"
              canvasProps={{
                width: 480,
                height: 160,
                className: 'w-full touch-none',
              }}
              onEnd={handleCanvasEnd}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClearCanvas}
              className="text-xs text-muted-foreground hover:underline"
            >
              Clear
            </button>
            {value?.imageBase64 && (
              <span className="text-xs text-green-600">✓ Signature captured</span>
            )}
          </div>
          {/* Preview of captured signature */}
          {value?.imageBase64 && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${value.imageBase64}`}
              alt="Captured signature"
              className="max-h-16 object-contain opacity-60 rounded border"
            />
          )}
        </div>
      )}

      {/* Typed mode */}
      {!readOnly && mode === 'typed' && (
        <div className="space-y-2">
          <input
            type="text"
            value={typedName}
            onChange={(e) => handleTypedChange(e.target.value)}
            placeholder="Type your full name…"
            className="w-full rounded-md border bg-background px-3 py-2 text-xl italic font-serif focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {typedName.trim() && (
            <p className="text-xs text-muted-foreground">
              Your typed name will be cryptographically bound to this submission.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
