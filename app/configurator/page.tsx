'use client';
import { useState, useEffect } from 'react';
import DeckViewer from '../../components/DeckViewer';
import DesignCanvas from '../../components/DesignCanvas';
import type { Build } from './types';
import OptionGrid from '../../components/OptionGrid';
import { deckShapes, deckThicknesses, deckFinishes, fullLedOption, trucks as truckOptions, wheels as wheelOptions } from './catalog';

export default function ConfiguratorPage() {
  const [deckColor, setDeckColor] = useState('#BB4BFF');
  const [ledColor, setLedColor] = useState('#00FFEA');
  const [ledIntensity, setLedIntensity] = useState(1);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Design editor texture (dataURL)
  const [deckTexture, setDeckTexture] = useState<string | null>(null);

  // Basic build object for now; we'll extend it as categories are added
  const [build, setBuild] = useState<Build>({ deckColor, ledColor, ledIntensity, uploadFile: null });

  // Deck options
  const [selectedDeckShape, setSelectedDeckShape] = useState<string[]>([deckShapes[0]?.id]);
  const [selectedDeckThickness, setSelectedDeckThickness] = useState<string[]>([deckThicknesses[0]?.id]);
  const [selectedTrucks, setSelectedTrucks] = useState<string[]>([truckOptions[0]?.id]);
  const [selectedWheels, setSelectedWheels] = useState<string[]>([wheelOptions[0]?.id]);
  const [selectedDeckFinish, setSelectedDeckFinish] = useState<string[]>([deckFinishes[0]?.id]);
  const [selectedFullLed, setSelectedFullLed] = useState<string[]>([fullLedOption[1]?.id]);
  const [messages, setMessages] = useState<string[]>([]);

  // initialize build with defaults
  useEffect(() => {
    setBuild((b) => ({ ...b, deckShapeId: deckShapes[0]?.id, deckThicknessId: deckThicknesses[0]?.id as '3_4' | '1' }));
  }, []);

  import('./catalog').then(mod => {
    /* no-op: ensure catalog is bundled; we'll reference directly below */
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    const f = e.target.files && e.target.files[0];
    if (!f) {
      setUploadFile(null);
      setUploadPreview(null);
      setBuild((b) => ({ ...b, uploadFile: null }));
      return;
    }

    const name = f.name.toLowerCase();
    const ok = /\.(pdf|eps|ai|png|jpe?g|svg)$/i.test(name);
    if (!ok) {
      setUploadError('Unsupported file type. Allowed: .pdf, .eps, .ai, .png, .jpg, .svg');
      setUploadFile(null);
      setUploadPreview(null);
      setBuild((b) => ({ ...b, uploadFile: null }));
      return;
    }

    setUploadFile(f);
    setBuild((b) => ({ ...b, uploadFile: f }));

    // If it's an image, create a data URL preview
    if (f.type.startsWith('image/') || name.endsWith('.svg')) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadPreview(String(reader.result));
      };
      reader.readAsDataURL(f);
    } else {
      setUploadPreview(null);
    }
  }

  function clearUpload() {
    setUploadFile(null);
    setUploadPreview(null);
    setUploadError(null);
    setBuild((b) => ({ ...b, uploadFile: null }));
  }

  // Validation and rules enforcement
  useEffect(() => {
    const msgs: string[] = [];

    // Drop-through decks limited to 3/4" thickness
    if (selectedShape?.dropThrough && selectedDeckThickness[0] !== '3_4') {
      setSelectedDeckThickness(['3_4']);
      setBuild((b) => ({ ...b, deckThicknessId: '3_4' }));
      msgs.push('Drop-through decks are limited to 3/4" thickness — switching thickness to 3/4".');
    }

    // Full LED not allowed on drop-through decks
    if (selectedShape?.dropThrough && selectedFullLed[0] === 'led_yes') {
      setSelectedFullLed(['led_no']);
      setBuild((b) => ({ ...b, fullLedDeck: false }));
      msgs.push('Full LED deck is not compatible with Drop-through decks — disabled.');
    }

    // 1" thickness only allowed with CLEAR finish
    if (selectedDeckThickness[0] === '1' && selectedDeckFinish[0] !== 'finish_clear') {
      setSelectedDeckFinish(['finish_clear']);
      setBuild((b) => ({ ...b, deckFinish: 'clear' }));
      msgs.push('1\" thickness requires Clear finish — switching finish to Clear.');
    }

    setMessages(msgs);
  }, [selectedDeckShape, selectedDeckThickness, selectedDeckFinish, selectedFullLed]);

  // keep build in sync with color/intensity fields
  function onDeckColorChange(v: string) {
    setDeckColor(v);
    setBuild((b) => ({ ...b, deckColor: v }));
  }
  function onLedColorChange(v: string) {
    setLedColor(v);
    setBuild((b) => ({ ...b, ledColor: v }));
  }
  function onLedIntensityChange(v: number) {
    setLedIntensity(v);
    setBuild((b) => ({ ...b, ledIntensity: v }));
  }

  // determine currently selected shape dimensions
  const selectedShapeId = selectedDeckShape[0] || null;
  const selectedShape = deckShapes.find((d) => d.id === selectedShapeId);
  const deckLength = selectedShape?.length ?? 1.0; // meters
  const deckWidth = selectedShape?.width ?? 0.26; // meters

  // Trucks
  const selectedTruckId = selectedTrucks[0] || null;
  const selectedTruck = truckOptions.find((t) => t.id === selectedTruckId);
  // map truck to a simple color for the viewer (basic pick from known ids)
  function truckColorFromId(id?: string) {
    if (!id) return '#222222';
    if (id.includes('black')) return '#111827';
    if (id.includes('white')) return '#ffffff';
    if (id.includes('silver')) return '#c7ccd1';
    if (id.includes('gold')) return '#b8912f';
    if (id.includes('blue')) return '#1167b1';
    return '#333333';
  }
  const truckColor = truckColorFromId(selectedTruckId ?? undefined);
  const trucksEnabled = !!selectedTruckId;

  // Wheels
  const selectedWheelId = selectedWheels[0] || null;
  const selectedWheel = wheelOptions.find((w) => w.id === selectedWheelId);
  function wheelColorFromId(id?: string) {
    if (!id) return '#ffffff';
    if (id.includes('white')) return '#ffffff';
    if (id.includes('black')) return '#111827';
    if (id.includes('red')) return '#d93b3b';
    if (id.includes('clear')) return '#e6f7ff';
    return '#ffffff';
  }
  const wheelColor = wheelColorFromId(selectedWheelId ?? undefined);
  const wheelsEnabled = !!selectedWheelId;

  // Deck finish + full LED selection
  const selectedFinishId = selectedDeckFinish[0] || null;
  const finish = deckFinishes.find((f) => f.id === selectedFinishId);
  const fullLedId = selectedFullLed[0] || null;
  const fullLedSelected = fullLedId === 'led_yes';
  return (
    <div className="container">
      <h1>Configurator</h1>
      <div className="panel">
        <div className="canvasWrap">
          <DeckViewer
            deckColor={deckColor}
            ledColor={ledColor}
            ledIntensity={ledIntensity}
            deckLength={deckLength}
            deckWidth={deckWidth}
            truckColor={truckColor}
            trucksEnabled={trucksEnabled}
            wheelColor={wheelColor}
            wheelsEnabled={wheelsEnabled}
            fullLedEnabled={fullLedSelected}
            dropThrough={selectedShape?.dropThrough}
            deckTexture={deckTexture}
          />
        </div>

        <div className="controls">
          <label className="control">
            Deck color
            <input type="color" value={deckColor} onChange={(e) => onDeckColorChange(e.target.value)} />
          </label>

          <label className="control">
            LED color
            <input type="color" value={ledColor} onChange={(e) => onLedColorChange(e.target.value)} />
          </label>

          <label className="control">
            LED intensity
            <input
              type="range"
              min="0"
              max="4"
              step="0.01"
              value={String(ledIntensity)}
              onChange={(e) => onLedIntensityChange(Number(e.target.value))}
            />
            <span style={{ marginLeft: 8 }}>{ledIntensity.toFixed(2)}</span>
          </label>
        </div>

        <h3 style={{ marginTop: 18 }}>Deck Size & Shape</h3>
        <p style={{ color: 'var(--muted)', marginTop: 6, marginBottom: 8 }}>Choose the deck profile that best fits your riding.</p>
        <OptionGrid
          options={deckShapes}
          mode="single"
          selected={selectedDeckShape}
          onChange={(next) => {
            setSelectedDeckShape(next);
            // store in build
            setBuild((b) => ({ ...b, deckShapeId: next[0] }));
          }}
        />

        <h3 style={{ marginTop: 18 }}>Deck Thickness</h3>
        <p style={{ color: 'var(--muted)', marginTop: 6, marginBottom: 8 }}>Choose deck thickness.</p>
        <OptionGrid
          options={deckThicknesses}
          mode="single"
          selected={selectedDeckThickness}
          onChange={(next) => {
            setSelectedDeckThickness(next);
            setBuild((b) => ({ ...b, deckThicknessId: next[0] as '3_4' | '1' }));
          }}
        />

        <h3 style={{ marginTop: 18 }}>Deck Finish</h3>
        <p style={{ color: 'var(--muted)', marginTop: 6, marginBottom: 8 }}>Clear finish required for 1&quot; thickness.</p>
        <OptionGrid
          options={deckFinishes}
          mode="single"
          selected={selectedDeckFinish}
          onChange={(next) => {
            setSelectedDeckFinish(next);
            setBuild((b) => ({ ...b, deckFinish: next[0] === 'finish_clear' ? 'clear' : 'color' }));
          }}
        />

        <h3 style={{ marginTop: 18 }}>Full LED Deck</h3>
        <p style={{ color: 'var(--muted)', marginTop: 6, marginBottom: 8 }}>Full LED deck may be incompatible with some shapes.</p>
        <OptionGrid
          options={fullLedOption}
          mode="single"
          selected={selectedFullLed}
          onChange={(next) => {
            setSelectedFullLed(next);
            setBuild((b) => ({ ...b, fullLedDeck: next[0] === 'led_yes' }));
          }}
        />

        <h3 style={{ marginTop: 18 }}>Trucks</h3>
        <p style={{ color: 'var(--muted)', marginTop: 6, marginBottom: 8 }}>Choose your trucks (single-select).</p>
        <OptionGrid
          options={truckOptions}
          mode="single"
          selected={selectedTrucks}
          onChange={(next) => {
            setSelectedTrucks(next);
            setBuild((b) => ({ ...b, trucksId: next[0] }));
          }}
        />

        <h3 style={{ marginTop: 18 }}>Wheels</h3>
        <p style={{ color: 'var(--muted)', marginTop: 6, marginBottom: 8 }}>Choose wheels (single-select).</p>
        <OptionGrid
          options={wheelOptions}
          mode="single"
          selected={selectedWheels}
          onChange={(next) => {
            setSelectedWheels(next);
            setBuild((b) => ({ ...b, wheelsId: next[0] }));
          }}
        />
        <h3 style={{ marginTop: 16 }}>Upload Your Design File</h3>
        <p style={{ color: 'var(--muted)', marginTop: 6, marginBottom: 8 }}>
          Optional: upload a .pdf, .eps, .ai, or image file for custom designs.
        </p>

        <div className="uploadBox">
          <input
            type="file"
            accept=".pdf,.eps,.ai,.png,.jpg,.jpeg,.svg"
            onChange={handleFileChange}
            aria-label="Upload your design file"
          />

          <div>
            {uploadError && <div style={{ color: '#ff6b6b' }}>{uploadError}</div>}
            {uploadPreview ? (
              <img className="uploadPreview" src={uploadPreview} alt="Preview" />
            ) : uploadFile ? (
              <div className="uploadMeta">
                <div>{uploadFile.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>{(uploadFile.size / 1024).toFixed(0)} KB</div>
              </div>
            ) : (
              <div className="uploadMeta">No file chosen</div>
            )}
          </div>

          <h3 style={{ marginTop: 18 }}>Design Editor</h3>
          <p style={{ color: 'var(--muted)', marginTop: 6, marginBottom: 8 }}>Create a 2D artwork for your deck. The canvas exports a texture that updates in real-time on the 3D preview.</p>
          <DesignCanvas onChange={(dataUrl) => setDeckTexture(dataUrl)} />

          <div style={{ marginLeft: 'auto' }}>
            {uploadFile && (
              <button onClick={clearUpload} style={{ background: 'transparent', color: 'var(--accent)', border: '1px solid rgba(255,255,255,0.04)', padding: '6px 10px', borderRadius: 6 }}>
                Clear
              </button>
            )}
          </div>
        </div>

        {messages.length > 0 && (
          <div role="status" aria-live="polite" style={{ marginTop: 12, padding: 10, background: 'rgba(255,100,100,0.06)', borderRadius: 6 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ color: '#ffb4b4' }}>⚠️ {m}</div>
            ))}
          </div>
        )}

        <div className="summary">
          <strong>Order Summary</strong>
          <div style={{ marginTop: 8 }}>
            <div>
              Deck Shape: <strong>{selectedShape ? selectedShape.label : '—'}</strong>
              {selectedShape && <span style={{ marginLeft: 8, color: 'var(--muted)' }}>{selectedShapeId}</span>}
            </div>
            <div>Deck Thickness: <strong>{deckThicknesses.find((d) => d.id === selectedDeckThickness[0])?.label ?? '—'}</strong></div>
            <div>Deck color: <span style={{ color: deckColor }}>{deckColor}</span></div>
            <div>LED color: <span style={{ color: ledColor }}>{ledColor}</span></div>
            <div>LED intensity: {ledIntensity.toFixed(2)}</div>
            <div>Trucks: <strong>{selectedTruck?.label ?? '—'}</strong> {selectedTruck ? <span style={{ marginLeft: 8, color: 'var(--muted)' }}>({selectedTruck.priceDelta ? `$+${selectedTruck.priceDelta}` : 'Included'})</span> : null}</div>
            <div>Upload: {uploadFile ? uploadFile.name : 'none'}</div>

            {/* Price breakdown */}
            <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid rgba(255,255,255,0.03)' }} />
            {(() => {
              const basePrice = 199;
              const shapePrice = selectedShape?.priceDelta ?? 0;
              const thicknessPrice = deckThicknesses.find((d) => d.id === selectedDeckThickness[0])?.priceDelta ?? 0;
              const finishPrice = deckFinishes.find((f) => f.id === selectedDeckFinish[0])?.priceDelta ?? 0;
              const truckPrice = selectedTruck?.priceDelta ?? 0;
              const wheelPrice = selectedWheel?.priceDelta ?? 0;
              const ledPrice = fullLedOption.find((f) => f.id === selectedFullLed[0])?.priceDelta ?? 0;
              const subtotal = basePrice + shapePrice + thicknessPrice + finishPrice + truckPrice + wheelPrice + ledPrice;

              return (
                <div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Base board: <strong>${basePrice}</strong></div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Shape: <strong>${shapePrice}</strong></div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Thickness: <strong>${thicknessPrice}</strong></div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Trucks: <strong>${truckPrice}</strong></div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Wheels: <strong>${wheelPrice}</strong></div>
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>Full LED: <strong>${ledPrice}</strong></div>
                  <div style={{ marginTop: 8 }}>Total: <strong>${subtotal}</strong></div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
