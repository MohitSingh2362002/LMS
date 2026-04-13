import React, { useState, useEffect } from 'react';
import { Monitor, Mic, Volume2, Sliders } from 'lucide-react';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { DeviceSettings, VideoQuality } from '../../types';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

async function getDevices(kind: MediaDeviceKind): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === kind);
  } catch {
    return [];
  }
}

const qualityOptions: { label: string; value: VideoQuality }[] = [
  { label: 'Auto', value: 'auto' },
  { label: 'High (720p)', value: 'high' },
  { label: 'Medium (480p)', value: 'medium' },
  { label: 'Low (240p)', value: 'low' },
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [settings, setSettings] = useState<DeviceSettings>({
    cameraDeviceId: '',
    micDeviceId: '',
    speakerDeviceId: '',
    backgroundBlur: false,
    noiseSuppression: true,
    videoQuality: 'auto',
  });

  useEffect(() => {
    if (!open) return;
    getDevices('videoinput').then(setCameras);
    getDevices('audioinput').then(setMics);
    getDevices('audiooutput').then(setSpeakers);
  }, [open]);

  const update = (key: keyof DeviceSettings, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Modal open={open} onClose={onClose} title="Settings" className="max-w-lg">
      <div className="space-y-6">
        {/* Camera */}
        <SettingSection icon={<Monitor size={15} />} title="Camera">
          <DeviceSelect
            devices={cameras}
            value={settings.cameraDeviceId}
            onChange={(v) => update('cameraDeviceId', v)}
            placeholder="Default camera"
          />
        </SettingSection>

        {/* Microphone */}
        <SettingSection icon={<Mic size={15} />} title="Microphone">
          <DeviceSelect
            devices={mics}
            value={settings.micDeviceId}
            onChange={(v) => update('micDeviceId', v)}
            placeholder="Default microphone"
          />
        </SettingSection>

        {/* Speaker */}
        <SettingSection icon={<Volume2 size={15} />} title="Speaker">
          {speakers.length > 0 ? (
            <DeviceSelect
              devices={speakers}
              value={settings.speakerDeviceId}
              onChange={(v) => update('speakerDeviceId', v)}
              placeholder="Default speaker"
            />
          ) : (
            <p className="text-white/40 text-sm">Speaker selection not supported on this browser.</p>
          )}
        </SettingSection>

        {/* Quality */}
        <SettingSection icon={<Sliders size={15} />} title="Video Quality">
          <div className="flex gap-2 flex-wrap">
            {qualityOptions.map((q) => (
              <button
                key={q.value}
                onClick={() => update('videoQuality', q.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  settings.videoQuality === q.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-surface-800 text-white/60 hover:text-white hover:bg-surface-700'
                }`}
              >
                {q.label}
              </button>
            ))}
          </div>
        </SettingSection>

        {/* Toggles */}
        <SettingSection icon={<Sliders size={15} />} title="Enhancements">
          <div className="space-y-3">
            <Toggle
              label="Background Blur"
              subLabel="Coming soon"
              enabled={settings.backgroundBlur}
              disabled
              onChange={(v) => update('backgroundBlur', v)}
            />
            <Toggle
              label="Noise Suppression"
              subLabel="Reduces background noise"
              enabled={settings.noiseSuppression}
              onChange={(v) => update('noiseSuppression', v)}
            />
          </div>
        </SettingSection>

        <Button onClick={onClose} className="w-full justify-center">
          Apply & Close
        </Button>
      </div>
    </Modal>
  );
}

function SettingSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-white/60 text-xs font-semibold uppercase tracking-wider mb-2.5">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function DeviceSelect({ devices, value, onChange, placeholder }: {
  devices: MediaDeviceInfo[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-surface-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/60 appearance-none"
    >
      <option value="">{placeholder}</option>
      {devices.map((d) => (
        <option key={d.deviceId} value={d.deviceId}>
          {d.label || `Device ${d.deviceId.slice(0, 8)}`}
        </option>
      ))}
    </select>
  );
}

function Toggle({ label, subLabel, enabled, onChange, disabled }: {
  label: string;
  subLabel?: string;
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className={`text-sm font-medium ${disabled ? 'text-white/30' : 'text-white'}`}>{label}</p>
        {subLabel && <p className="text-white/30 text-xs">{subLabel}</p>}
      </div>
      <button
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`relative w-10 h-5 rounded-full transition-colors ${
          enabled ? 'bg-brand-600' : 'bg-surface-700'
        } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
